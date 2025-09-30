const { Jump, JumpsRecord, Stock } = require('../models');
const axios = require('axios');
const { stock_codes } = require('../saveData');
const { errorHandler } = require('../helpers/responseHelper');
const moment = require('moment');
const iconv = require('iconv-lite');

// ========== 台灣證券交易所國定假日清單 (需定期更新) ==========
const taiwanHolidays = {
    '2025': [
        '20250101', // 元旦
        '20250127', '20250128', '20250129', '20250130', '20250131', // 春節
        '20250228', // 和平紀念日
        '20250403', '20250404', // 清明節
        '20250501', // 勞動節
        '20250530', // 端午節
        '20250929', // 教師節
        '20251010', // 國慶日
        '20251024', // 臺灣光復暨金門古寧頭大捷紀念日
        '20251225', // 行憲紀念日
    ],
    '2024': [
        '20240101', // 元旦
        '20240208', '20240209', '20240210', '20240211', '20240212', '20240213', '20240214', // 春節
        '20240228', // 和平紀念日
        '20240404', '20240405', // 清明節
        '20240501', // 勞動節
        '20240608', '20240609', '20240610', // 端午節
        '20240917', // 中秋節
        '20241010', // 國慶日
    ],
};

// 檢查是否為國定假日
function isHoliday(dateStr) {
    const year = dateStr.substring(0, 4);
    const holidays = taiwanHolidays[year] || [];
    return holidays.includes(dateStr);
}

// 檢查是否為交易日
function isTradingDay(dateStr) {
    const date = moment(dateStr, 'YYYYMMDD');
    
    // 週末不是交易日
    if (date.day() === 0 || date.day() === 6) {
        return false;
    }
    
    // 國定假日不是交易日
    if (isHoliday(dateStr)) {
        return false;
    }
    
    return true;
}

// 獲取下一個交易日
function getNextTradingDay(dateStr) {
    let date = moment(dateStr, 'YYYYMMDD');
    let attempts = 0;
    const maxAttempts = 30; // 避免無限循環
    
    while (attempts < maxAttempts) {
        date.add(1, 'day');
        const dateString = date.format('YYYYMMDD');
        
        if (isTradingDay(dateString)) {
            return dateString;
        }
        
        attempts++;
    }
    
    console.error('Unable to find next trading day within 30 days');
    return dateStr;
}

// 獲取前一個交易日
function getPreviousTradingDay(dateStr) {
    let date = moment(dateStr, 'YYYYMMDD');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
        date.subtract(1, 'day');
        const dateString = date.format('YYYYMMDD');
        
        if (isTradingDay(dateString)) {
            return dateString;
        }
        
        attempts++;
    }
    
    console.error('Unable to find previous trading day within 30 days');
    return dateStr;
}

// 調整到該週第一個交易日
function adjustToFirstTradingDayOfWeek(dateStr) {
    const date = moment(dateStr, 'YYYYMMDD');
    
    // 如果傳入的日期本身就是交易日，找到該週週一開始算起的第一個交易日
    let weekStart = date.clone().startOf('week'); // 週一
    
    // 從週一開始找第一個交易日
    for (let i = 0; i < 7; i++) {
        const checkDate = weekStart.clone().add(i, 'days');
        const checkDateStr = checkDate.format('YYYYMMDD');
        
        // 如果這天是交易日，且不晚於傳入的日期
        if (isTradingDay(checkDateStr) && !checkDate.isAfter(date)) {
            return checkDateStr;
        }
    }
    
    // 如果週一到傳入日期之間都沒有交易日，使用傳入日期的下一個交易日
    return getNextTradingDay(dateStr);
}

// 調整到該月第一個交易日
function adjustToFirstTradingDayOfMonth(dateStr) {
    const date = moment(dateStr, 'YYYYMMDD');
    const monthStart = date.clone().startOf('month');
    
    // 從月初開始找第一個交易日
    let currentDay = monthStart.clone();
    const monthEnd = date.clone().endOf('month');
    
    while (currentDay.isSameOrBefore(monthEnd)) {
        const checkDateStr = currentDay.format('YYYYMMDD');
        
        // 如果這天是交易日，且不晚於傳入的日期
        if (isTradingDay(checkDateStr) && !currentDay.isAfter(date)) {
            return checkDateStr;
        }
        
        currentDay.add(1, 'day');
    }
    
    // 如果月初到傳入日期之間都沒有交易日，使用傳入日期的下一個交易日
    return getNextTradingDay(dateStr);
}

// 數據驗證輔助函數
const isValidPriceData = (record) => {
    return (
        record.o !== null &&
        record.o !== undefined &&
        record.h !== null &&
        record.h !== undefined &&
        record.l !== null &&
        record.l !== undefined &&
        record.c !== null &&
        record.c !== undefined &&
        record.v !== null &&
        record.v !== undefined
    );
};

const isReasonablePrice = (record) => {
    return (
        record.o > 0 &&
        record.h > 0 &&
        record.l > 0 &&
        record.c > 0 &&
        record.o < 10000 &&
        record.h < 10000 &&
        record.l < 10000 &&
        record.c < 10000
    );
};

const isPriceLogicallyValid = (record) => {
    return (
        record.h >= record.l &&
        record.h >= record.o &&
        record.h >= record.c &&
        record.l <= record.o &&
        record.l <= record.c
    );
};

// 解析 CSV 數據的輔助函數
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current.trim());
    return fields;
}

// 從台灣證交所獲取單日資料
async function fetchTWSEDailyData(date) {
    try {
        const url = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=csv&date=${date}&type=ALL`;

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000,
        });

        const csvData = iconv.decode(response.data, 'big5');
        const lines = csvData.split('\n').filter((line) => line.trim());

        let dataStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('證券代號') || lines[i].includes('Security Code')) {
                dataStartIndex = i;
                break;
            }
        }

        if (dataStartIndex === -1) {
            return {};
        }

        const stockData = {};

        for (let i = dataStartIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const fields = parseCSVLine(line);
            if (fields.length < 9) continue;

            const stockCode = fields[0]?.replace(/"/g, '').trim();
            if (!stockCode || stockCode.length !== 4) continue;

            try {
                const volume = parseInt(fields[2]?.replace(/[",]/g, '')) || 0;
                const open = parseFloat(fields[5]?.replace(/[",]/g, '')) || 0;
                const high = parseFloat(fields[6]?.replace(/[",]/g, '')) || 0;
                const low = parseFloat(fields[7]?.replace(/[",]/g, '')) || 0;
                const close = parseFloat(fields[8]?.replace(/[",]/g, '')) || 0;

                if (open > 0 && high > 0 && low > 0 && close > 0) {
                    stockData[stockCode] = {
                        t: date,
                        o: open,
                        h: high,
                        l: low,
                        c: close,
                        v: volume,
                    };
                }
            } catch (error) {
                continue;
            }
        }

        return stockData;
    } catch (error) {
        console.error(`Error fetching TWSE data for ${date}:`, error.message);
        return {};
    }
}

// 格式化櫃買中心日期
function formatDateForOTC(date) {
    try {
        const year = parseInt(date.substring(0, 4));
        const month = date.substring(4, 6);
        const day = date.substring(6, 8);
        const rocYear = year - 1911;
        
        const formattedDate = `${rocYear}/${month}/${day}`;
        
        return formattedDate;
    } catch (error) {
        console.error('Error formatting date for OTC:', error.message);
        return date;
    }
}

// 從櫃買中心獲取單日資料
async function fetchOTCDailyData(date) {
    try {
        const url = `https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d=${date}&se=AL`;
        
        const response = await axios.get(url, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.tpex.org.tw/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.data) {
            console.warn('OTC API returned no data');
            return {};
        }
        
        const stockData = {};
        let jsonData = response.data;
        
        if (typeof response.data === 'string') {
            try {
                jsonData = JSON.parse(response.data);
            } catch (parseError) {
                console.error('Failed to parse OTC response as JSON:', parseError.message);
                return {};
            }
        }
        
        // 處理新的 tables 格式
        if (jsonData.tables && Array.isArray(jsonData.tables) && jsonData.tables.length > 0) {
            const table = jsonData.tables[0];
            
            if (table.data && Array.isArray(table.data)) {
                for (const row of table.data) {
                    try {
                        if (!Array.isArray(row) || row.length < 8) {
                            continue;
                        }
                        
                        const stockCode = row[0]?.toString().trim();
                        if (!stockCode || !/^\d{4}$/.test(stockCode)) continue;
                        
                        const closeStr = row[2]?.toString().replace(/[,\s]/g, '') || '0';
                        const openStr = row[4]?.toString().replace(/[,\s]/g, '') || '0';
                        const highStr = row[5]?.toString().replace(/[,\s]/g, '') || '0';
                        const lowStr = row[6]?.toString().replace(/[,\s]/g, '') || '0';
                        const volumeStr = row[7]?.toString().replace(/[,\s]/g, '') || '0';
                        
                        const close = parseFloat(closeStr) || 0;
                        const open = parseFloat(openStr) || 0;
                        const high = parseFloat(highStr) || 0;
                        const low = parseFloat(lowStr) || 0;
                        const volume = parseInt(volumeStr) || 0;
                        
                        if (open > 0 && high > 0 && low > 0 && close > 0) {
                            stockData[stockCode] = {
                                t: date.replace(/\//g, ''),
                                o: open,
                                h: high,
                                l: low,
                                c: close,
                                v: volume,
                            };
                        }
                    } catch (error) {
                        console.error(`Error processing OTC row:`, error.message);
                        continue;
                    }
                }
            }
        }
        // 向下相容舊格式
        else if (jsonData.aaData && Array.isArray(jsonData.aaData)) {
            for (const row of jsonData.aaData) {
                try {
                    if (!Array.isArray(row) || row.length < 8) continue;
                    
                    const stockCode = row[0]?.toString().trim();
                    if (!stockCode || !/^\d{4}$/.test(stockCode)) continue;
                    
                    const closeStr = row[2]?.toString().replace(/[,\s]/g, '') || '0';
                    const openStr = row[4]?.toString().replace(/[,\s]/g, '') || '0';
                    const highStr = row[5]?.toString().replace(/[,\s]/g, '') || '0';
                    const lowStr = row[6]?.toString().replace(/[,\s]/g, '') || '0';
                    const volumeStr = row[7]?.toString().replace(/[,\s]/g, '') || '0';
                    
                    const close = parseFloat(closeStr) || 0;
                    const open = parseFloat(openStr) || 0;
                    const high = parseFloat(highStr) || 0;
                    const low = parseFloat(lowStr) || 0;
                    const volume = parseInt(volumeStr) || 0;
                    
                    if (open > 0 && high > 0 && low > 0 && close > 0) {
                        stockData[stockCode] = {
                            t: date.replace(/\//g, ''),
                            o: open,
                            h: high,
                            l: low,
                            c: close,
                            v: volume,
                        };
                    }
                } catch (error) {
                    continue;
                }
            }
        } else {
            console.warn('OTC API response missing both tables and aaData');
        }
        
        return stockData;
        
    } catch (error) {
        console.error(`Error fetching OTC data for ${date}:`, error.message);
        return {};
    }
}

// 整合版本：根據股票 Market 欄位獲取資料
async function fetchStockDataByMarket(date, stockCodes) {
    try {
        // 根據 Market 欄位分組
        const twseStocks = stockCodes.filter(stock => stock.Market === 'TW');
        const otcStocks = stockCodes.filter(stock => stock.Market === 'TWO');
        
        const allStockData = {};
        const promises = [];
        
        // 只在有對應股票時才呼叫相應的 API
        if (twseStocks.length > 0) {
            promises.push(
                fetchTWSEDailyData(date).then(data => {
                    Object.assign(allStockData, data);
                })
            );
        }
        
        if (otcStocks.length > 0) {
            promises.push(
                fetchOTCDailyData(formatDateForOTC(date)).then(data => {
                    Object.assign(allStockData, data);
                })
            );
        }
        
        // 等待所有 API 完成
        await Promise.all(promises);
        
        return allStockData;
        
    } catch (error) {
        console.error(`Error fetching stock data for ${date}:`, error.message);
        return {};
    }
}

// 獲取週線/月線需要的完整交易日期範圍（過濾假日版本）
function getTradingDatesForPeriod(targetDate, perd) {
    const dates = [];
    const target = moment(targetDate, 'YYYYMMDD');

    if (perd === 'w') {
        // 週線：需要本週 + 上週的所有交易日
        const thisWeekStart = target.clone().startOf('week'); // 週一
        const lastWeekStart = thisWeekStart.clone().subtract(1, 'week');

        // 收集兩週的交易日
        for (let week = 0; week < 2; week++) {
            const weekStart = week === 0 ? thisWeekStart : lastWeekStart;

            for (let day = 0; day < 7; day++) {
                const date = weekStart.clone().add(day, 'days');
                const dateStr = date.format('YYYYMMDD');

                // 跳過週末
                if (date.day() === 0 || date.day() === 6) continue;
                
                // 跳過國定假日
                if (isHoliday(dateStr)) continue;

                // 本週不要超過目標日期
                if (week === 0 && date.isAfter(target)) continue;

                dates.push({
                    date: dateStr,
                    week: week === 0 ? 'thisWeek' : 'lastWeek',
                    weekStart: weekStart.format('YYYYMMDD'),
                });
            }
        }
    } else if (perd === 'm') {
        // 月線：需要本月 + 上月的所有交易日
        const thisMonthStart = target.clone().startOf('month');
        const lastMonthStart = thisMonthStart.clone().subtract(1, 'month');

        // 收集兩個月的交易日
        for (let month = 0; month < 2; month++) {
            const monthStart = month === 0 ? thisMonthStart : lastMonthStart;
            const monthEnd = monthStart.clone().endOf('month');

            let currentDay = monthStart.clone();
            while (currentDay.isSameOrBefore(monthEnd)) {
                const dateStr = currentDay.format('YYYYMMDD');
                
                // 跳過週末
                if (currentDay.day() !== 0 && currentDay.day() !== 6) {
                    // 跳過國定假日
                    if (!isHoliday(dateStr)) {
                        // 本月不要超過目標日期
                        if (month === 0 && currentDay.isAfter(target)) {
                            break;
                        }

                        dates.push({
                            date: dateStr,
                            month: month === 0 ? 'thisMonth' : 'lastMonth',
                            monthStart: monthStart.format('YYYYMMDD'),
                        });
                    }
                }
                currentDay.add(1, 'day');
            }
        }
    }

    return dates;
}

// 合併週線K線資料
function aggregateToWeeklyKLine(dailyDataArray) {
    if (!dailyDataArray || dailyDataArray.length === 0) return null;

    // 按日期排序
    const sortedData = dailyDataArray.sort((a, b) => parseInt(a.t) - parseInt(b.t));

    const weeklyK = {
        t: sortedData[0].t,
        o: sortedData[0].o,
        h: Math.max(...sortedData.map((d) => d.h)),
        l: Math.min(...sortedData.map((d) => d.l)),
        c: sortedData[sortedData.length - 1].c,
        v: sortedData.reduce((sum, d) => sum + d.v, 0),
    };

    return weeklyK;
}

// 合併月線K線資料
function aggregateToMonthlyKLine(dailyDataArray) {
    if (!dailyDataArray || dailyDataArray.length === 0) return null;

    // 按日期排序
    const sortedData = dailyDataArray.sort((a, b) => parseInt(a.t) - parseInt(b.t));

    const monthlyK = {
        t: sortedData[0].t,
        o: sortedData[0].o,
        h: Math.max(...sortedData.map((d) => d.h)),
        l: Math.min(...sortedData.map((d) => d.l)),
        c: sortedData[sortedData.length - 1].c,
        v: sortedData.reduce((sum, d) => sum + d.v, 0),
    };

    return monthlyK;
}

// 優化的批量處理函數
async function fetchOptimizedBatchData(targets, perd, date) {
    try {
        // 獲取需要的所有交易日期
        const tradingDateDetails = getTradingDatesForPeriod(date, perd);

        if (tradingDateDetails.length === 0) {
            console.warn(`No trading dates found for ${date}`);
            return [];
        }

        console.log(`Found ${tradingDateDetails.length} trading dates to fetch`);

        // 一次性獲取所有日期的完整市場資料
        const allMarketData = new Map();

        // 去重日期
        const uniqueDates = [...new Set(tradingDateDetails.map((d) => d.date))];

        for (const tradingDate of uniqueDates) {
            console.log(`Fetching market data for ${tradingDate}...`);
            
            const dailyMarketData = await fetchStockDataByMarket(tradingDate, targets);
            allMarketData.set(tradingDate, dailyMarketData);
            
            // 請求間隔，避免被封鎖
            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // 批量處理所有目標股票
        const results = [];

        for (const target of targets) {
            try {
                // 收集該股票的所有日線資料
                const stockDailyData = [];

                for (const dateDetail of tradingDateDetails) {
                    const marketData = allMarketData.get(dateDetail.date);
                    if (marketData && marketData[target.code]) {
                        stockDailyData.push({
                            ...marketData[target.code],
                            period: perd === 'w' ? dateDetail.week : dateDetail.month,
                            periodStart: perd === 'w' ? dateDetail.weekStart : dateDetail.monthStart,
                        });
                    }
                }

                if (stockDailyData.length === 0) {
                    continue;
                }

                // 按週期分組資料
                const periodGroups = {};
                stockDailyData.forEach((data) => {
                    const groupKey = data.period;
                    if (!periodGroups[groupKey]) {
                        periodGroups[groupKey] = [];
                    }
                    periodGroups[groupKey].push(data);
                });

                // 生成週K或月K
                const thisK =
                    perd === 'w'
                        ? aggregateToWeeklyKLine(periodGroups['thisWeek'] || periodGroups['thisMonth'])
                        : aggregateToMonthlyKLine(periodGroups['thisMonth']);

                const lastK =
                    perd === 'w'
                        ? aggregateToWeeklyKLine(periodGroups['lastWeek'] || periodGroups['lastMonth'])
                        : aggregateToMonthlyKLine(periodGroups['lastMonth']);

                if (!thisK || !lastK) {
                    continue;
                }

                // 驗證K線資料品質
                if (!isValidPriceData(thisK) || !isValidPriceData(lastK)) {
                    continue;
                }

                if (!isReasonablePrice(thisK) || !isReasonablePrice(lastK)) {
                    continue;
                }

                if (!isPriceLogicallyValid(thisK) || !isPriceLogicallyValid(lastK)) {
                    continue;
                }

                // 跳空檢測邏輯
                const last_value = parseInt(Math.round(lastK.v / 1000));
                const this_open = Math.round(thisK.o * 100) / 100;
                const this_low = Math.round(thisK.l * 100) / 100;
                const last_high = Math.round(lastK.h * 100) / 100;

                // 向上跳空條件
                if (this_open > last_high && this_open > 10) {
                    results.push({
                        stockCode: target.code,
                        lastHight: last_high,
                        thisOpen: this_open,
                        thisLow: this_low,
                        date,
                        lastValue: last_value,
                        thisDate: thisK.t,
                        lastDate: lastK.t,
                        periodType: perd,
                        thisKLine: thisK,
                        lastKLine: lastK,
                        market: target.Market,
                    });
                }
            } catch (error) {
                console.error(`Error processing ${target.code}:`, error.message);
                continue;
            }
        }

        return results;
    } catch (error) {
        console.error('Error in fetchOptimizedBatchData:', error.message);
        return [];
    }
}

// === 主要業務邏輯函數 ===

const createJumps = async (req, res) => {
    try {
        let { perd, date } = req.body;
        
        if (!perd || !date) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        if (!['w', 'm'].includes(perd)) {
            return res.status(400).json({ message: 'perd must be "w" or "m"', success: false });
        }

        // 檢查傳入的日期是否為交易日，如果不是，自動調整
        let adjustedDate = date;
        let dateAdjusted = false;
        
        if (!isTradingDay(date)) {
            console.log(`Input date ${date} is not a trading day (holiday or weekend)`);
            
            // 根據週期類型調整日期
            if (perd === 'w') {
                adjustedDate = adjustToFirstTradingDayOfWeek(date);
            } else if (perd === 'm') {
                adjustedDate = adjustToFirstTradingDayOfMonth(date);
            }
            
            dateAdjusted = true;
            console.log(`Date adjusted from ${date} to ${adjustedDate} (first trading day of ${perd === 'w' ? 'week' : 'month'})`);
        }

        console.log(
            `Starting ${perd === 'w' ? 'weekly' : 'monthly'} K-line jump detection for ${stock_codes.length} stocks...`
        );
        if (dateAdjusted) {
            console.log(`Using adjusted date: ${adjustedDate}`);
        }

        // 使用調整後的日期進行批量處理
        const data = await fetchOptimizedBatchData(stock_codes, perd, adjustedDate);

        console.log(`${perd.toUpperCase()}-line jump detection completed. Found ${data.length} jump signals.`);

        // 統計各市場的跳空數量
        const marketStats = data.reduce((acc, jump) => {
            acc[jump.market] = (acc[jump.market] || 0) + 1;
            return acc;
        }, {});
        
        console.log('Jump distribution by market:', marketStats);

        const createdJumps = [];
        for (const jumpData of data) {
            const { stockCode, lastHight, thisOpen, lastValue, thisLow } = jumpData;
            const [jump] = await Jump.findOrCreate({
                where: { stockCode },
                defaults: { stockCode },
            });
            const existingRecord = await JumpsRecord.findOne({
                where: { jumpId: jump.id, date, type: perd },
            });
            let record = null;
            if (!existingRecord) {
                record = await JumpsRecord.create({
                    type: perd,
                    lastPrice: lastHight,
                    jumpPrice: thisOpen,
                    lastValue,
                    closed: thisLow > lastHight ? false : true,
                    jumpId: jump.id,
                    date,
                });
            }
            if (record) createdJumps.push({ code: stockCode });
        }

        if (createdJumps.length === 0) {
            return res.status(400).json({ 
                message: 'No new jumps created',
                dateAdjusted: dateAdjusted,
                originalDate: dateAdjusted ? date : undefined,
                adjustedDate: dateAdjusted ? adjustedDate : undefined,
                success: false 
            });
        }
        
        return res.status(200).json({
            message: 'Successful Created',
            newJumps: createdJumps,
            marketStats: marketStats,
            dateAdjusted: dateAdjusted,
            originalDate: dateAdjusted ? date : undefined,
            adjustedDate: dateAdjusted ? adjustedDate : date,
            success: true,
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getJumpRecord = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'Stock code is required', success: false });
        }

        let jump = await Jump.findOne({
            include: [
                {
                    model: Stock,
                    where: { code: id },
                    required: true,
                },
                {
                    model: JumpsRecord,
                    required: false,
                },
            ],
        });

        if (!jump) {
            return res.status(200).json({ message: 'Jump record not found', data: {}, success: true });
        }

        let newestRecord = null;
        let newestRecordClosed = null;
        let jumpCount_w = 0;
        let jumpCount_w_c = 0;
        let jumpCount_m = 0;
        let jumpCount_m_c = 0;

        jump.JumpsRecords.forEach((record) => {
            if (record.type === 'w') {
                if (record.closed) jumpCount_w_c++;
                jumpCount_w++;
            } else {
                if (record.closed) jumpCount_m_c++;
                jumpCount_m++;
            }

            if ((!newestRecord || moment(record.date).isAfter(moment(newestRecord.date))) && !record.closed) {
                newestRecord = record;
            }

            if (!newestRecordClosed || moment(record.date).isAfter(moment(newestRecordClosed.date))) {
                newestRecordClosed = record;
            }
        });

        if (!newestRecord) {
            newestRecord = newestRecordClosed;
        }

        let result = {
            ...jump.toJSON(),
            details: { jumpCount_w, jumpCount_m, jumpCount_w_c, jumpCount_m_c },
            newest: newestRecord,
        };

        return res.status(200).json({ data: result, success: true });
    } catch (error) {
        return res.status(500).json({ message: error.message, success: false });
    }
};

const getAllJumps = async (req, res) => {
    try {
        const { type, date, closed } = req.query;

        const stockLastUpdated = await Stock.findOne({
            attributes: ['updatedAt'],
            order: [['updatedAt', 'DESC']],
            limit: 1,
        });

        let jumps = await Jump.findAll({
            include: [Stock, JumpsRecord],
        });

        let result = [];
        let stockJumpCount = {};

        jumps.forEach((jump) => {
            let newestRecordClosed = null;
            let newestRecord = null;
            let jumpCount_w = 0;
            let jumpCount_w_c = 0;
            let jumpCount_m = 0;
            let jumpCount_m_c = 0;

            const filteredRecords = jump.JumpsRecords.filter((record) => {
                if (record.type === 'w') {
                    if (record.closed === true) {
                        jumpCount_w_c++;
                    }
                    jumpCount_w++;
                } else {
                    if (record.closed === true) {
                        jumpCount_m_c++;
                    }
                    jumpCount_m++;
                }

                if (date && record.date !== date) return false;

                if (type !== 'all' && record.type !== type) return false;
                if (type === 'all') {
                    if ((!newestRecord || moment(record.date).isAfter(moment(newestRecord))) && !record.closed) {
                        newestRecord = record;
                    }

                    if (!newestRecordClosed || moment(record.date).isAfter(moment(newestRecordClosed))) {
                        newestRecordClosed = record;
                    }
                } else {
                    if (record.date === date) {
                        newestRecordClosed = record;
                    }
                }
                return String(record.closed) === closed;
            });

            if (!newestRecord) {
                newestRecord = newestRecordClosed;
            }

            let details = {
                jumpCount_w,
                jumpCount_m,
                jumpCount_w_c,
                jumpCount_m_c,
            };

            const stockCode = jump.Stock.code;
            const stockIndustry = jump.Stock.industry;
            if (!stockJumpCount[stockCode]) {
                stockJumpCount[stockCode] = {
                    jumpCount_w: 0,
                    jumpCount_m: 0,
                    name: jump.Stock.name,
                    industry: stockIndustry,
                };
            }

            if (filteredRecords.length) {
                result.push({
                    ...jump.toJSON(),
                    details,
                    newest: newestRecord,
                });
            }
        });

        const final = {
            result,
        };

        return res
            .status(200)
            .json({ data: final, success: true, stockLastUpdated: stockLastUpdated?.updatedAt || null });
    } catch (error) {
        return res.status(500).send({ message: error.message, success: false });
    }
};

const updateIfClosed = async (req, res) => {
    try {
        const jumps = await Jump.findAll({
            include: [Stock, JumpsRecord],
        });

        for (const jump of jumps) {
            for (const record of jump.JumpsRecords) {
                if (record.lastPrice >= +jump.Stock.price && !record.closed) {
                    await record.update({ closed: true });
                }
            }
        }

        return res.status(200).json({ message: 'updateIfClosed task completed successfully', success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateJumpRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, closed, date, lastValue, jumpPrice, lastPrice } = req.body;

        if (!type || !lastPrice || closed === undefined || !date || !lastValue || !jumpPrice) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const body = {
            type,
            lastValue,
            jumpPrice,
            lastPrice,
            closed,
            date,
        };

        const [updated] = await JumpsRecord.update(body, {
            where: { id },
        });
        const data = await JumpsRecord.findOne({ where: { id } });
        if (updated) {
            return res.status(200).json({ data, success: true });
        } else {
            if (data) {
                return res.status(400).send({
                    message: 'unexpected error',
                    success: false,
                });
            } else {
                return res.status(400).send({
                    message: 'ID does not exists',
                    success: false,
                });
            }
        }
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const deleteJump = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Jump.destroy({
            where: { id },
        });
        if (deleted) {
            return res.status(200).send({ message: 'Successful deleted', success: true });
        }
        return res.status(400).send({
            message: 'ID does not exists',
            success: false,
        });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const bulkDeleteJumps = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send({
                message: 'IDs format error',
                success: false,
            });
        }

        const deletedCount = await Jump.destroy({
            where: { id: ids },
        });

        if (deletedCount > 0) {
            return res.status(200).send({
                message: `Successful deleted`,
                success: true,
                deletedCount,
            });
        } else {
            return res.status(400).send({
                message: 'ID does not exists',
                success: false,
            });
        }
    } catch (error) {
        return res.status(500).send({
            message: errorHandler(error),
            success: false,
        });
    }
};

const deleteJumpsRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const jumpsRecordToDelete = await JumpsRecord.findOne({
            where: { id },
        });

        const deleted = await jumpsRecordToDelete.destroy();
        if (deleted) {
            const jumpId = deleted.jumpId;

            const jumpHasRecords = await JumpsRecord.findOne({
                where: { jumpId: jumpsRecordToDelete.jumpId },
            });

            if (!jumpHasRecords) {
                await Jump.destroy({
                    where: { id: jumpId },
                });
            }
            return res.status(200).send({ message: 'Successful deleted', success: true });
        }
        return res.status(400).send({
            message: 'ID does not exists',
            success: false,
        });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const deleteJumpsRecords = async (req, res) => {
    try {
        await JumpsRecord.destroy({
            where: {},
            truncate: true,
        });
        return res.status(200).json({ message: 'All JumpRecords deleted successfully', success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// detectVolumeDecPriceRiseAdvanced 使用的 getPreviousTradingDate (已更新為使用假日過濾)
function getPreviousTradingDate(date) {
    try {
        let targetDate;
        if (typeof date === 'object') {
            date = date.date || date;
        }
        
        if (typeof date === 'string') {
            if (date.includes('-')) {
                targetDate = moment(date, 'YYYY-MM-DD');
            } else if (date.length === 8) {
                targetDate = moment(date, 'YYYYMMDD');
            } else {
                throw new Error('Invalid date format');
            }
        } else {
            throw new Error('Date must be string');
        }

        if (!targetDate.isValid()) {
            throw new Error('Invalid date');
        }

        // 使用 getPreviousTradingDay 函數，會自動過濾週末和假日
        return getPreviousTradingDay(targetDate.format('YYYYMMDD'));
    } catch (error) {
        console.error('Error in getPreviousTradingDate:', error.message, 'Input:', date);
        return null;
    }
}

const detectVolumeDecPriceRiseAdvanced = async (req, res) => {
    try {
        let { date, minVolume } = req.body;
        
        if (!date) {
            return res.status(400).json({ 
                message: 'Date is required', 
                success: false 
            });
        }

        if (typeof date === 'object' && date.date) {
            date = date.date;
        }

        let volumeFilter = 0;
        if (minVolume !== undefined && minVolume !== null) {
            volumeFilter = parseInt(minVolume) || 0;
        }

        let formattedDate;
        if (typeof date === 'string') {
            if (date.includes('-')) {
                formattedDate = date.replace(/-/g, '');
            } else if (date.length === 8) {
                formattedDate = date;
            } else {
                return res.status(400).json({ 
                    message: 'Invalid date format. Expected YYYY-MM-DD or YYYYMMDD', 
                    success: false 
                });
            }
        } else {
            return res.status(400).json({ 
                message: 'Date must be string', 
                success: false 
            });
        }

        // 檢查並調整日期（如果是假日）
        let adjustedDate = formattedDate;
        let dateAdjusted = false;
        
        if (!isTradingDay(formattedDate)) {
            adjustedDate = getNextTradingDay(formattedDate);
            dateAdjusted = true;
            console.log(`Input date ${formattedDate} is not a trading day, adjusted to ${adjustedDate}`);
        }

        // 獲取前兩個交易日（使用過濾假日的函數）
        const previousDate = getPreviousTradingDate(adjustedDate);
        const dayBeforePrevious = previousDate ? getPreviousTradingDate(previousDate) : null;
        
        if (!previousDate || !dayBeforePrevious) {
            return res.status(400).json({ 
                message: 'Unable to calculate previous trading dates', 
                success: false 
            });
        }
        
        let currentDayData = {};
        let previousDayData = {};
        let dayBeforePreviousData = {};

        try {
            currentDayData = await fetchStockDataByMarket(adjustedDate, stock_codes);
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            previousDayData = await fetchStockDataByMarket(previousDate, stock_codes);
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            dayBeforePreviousData = await fetchStockDataByMarket(dayBeforePrevious, stock_codes);
            
        } catch (fetchError) {
            console.error('Error fetching market data:', fetchError.message);
            return res.status(500).json({ 
                message: 'Failed to fetch market data: ' + fetchError.message, 
                success: false 
            });
        }
        
        const results = [];
        let processedCount = 0;
        let validDataCount = 0;
        let volumeFilteredCount = 0;
        
        for (const stockInfo of stock_codes) {
            try {
                processedCount++;
                const stockCode = stockInfo.code;
                const currentData = currentDayData[stockCode];
                const previousData = previousDayData[stockCode];
                const dayBeforePreviousData_stock = dayBeforePreviousData[stockCode];
                
                if (!currentData || !previousData || !dayBeforePreviousData_stock) {
                    continue;
                }
                
                validDataCount++;
                
                if (!isValidPriceData(currentData) || 
                    !isValidPriceData(previousData) || 
                    !isValidPriceData(dayBeforePreviousData_stock)) {
                    continue;
                }
                    
                if (!isReasonablePrice(currentData) || 
                    !isReasonablePrice(previousData) || 
                    !isReasonablePrice(dayBeforePreviousData_stock)) {
                    continue;
                }
                    
                if (!isPriceLogicallyValid(currentData) || 
                    !isPriceLogicallyValid(previousData) || 
                    !isPriceLogicallyValid(dayBeforePreviousData_stock)) {
                    continue;
                }
                
                const thisClose = parseFloat(currentData.c);
                const lastClose = parseFloat(previousData.c);
                const dayBeforeLastClose = parseFloat(dayBeforePreviousData_stock.c);
                const thisVolume = parseInt(Math.round(currentData.v / 1000));
                const lastVolume = parseInt(Math.round(previousData.v / 1000));
                
                const condition1 = thisClose > lastClose;
                const condition2 = thisVolume < lastVolume;
                const condition3 = thisClose > 10;
                const condition4 = lastClose < dayBeforeLastClose;
                const condition5 = thisVolume >= volumeFilter;
                
                if (condition1 && condition2 && condition3 && condition4 && !condition5) {
                    volumeFilteredCount++;
                    continue;
                }
                
                if (condition1 && condition2 && condition3 && condition4 && condition5) {
                    results.push({
                        stockCode: stockCode,
                        name: stockInfo.name || 'N/A',
                        industry: stockInfo.industry || 'N/A',
                        this_close: Math.round(thisClose * 100) / 100,
                        last_close: Math.round(lastClose * 100) / 100,
                        this_volume: Math.round(thisVolume),
                        last_volume: Math.round(lastVolume),
                        market: stockInfo.Market,
                        price_change: Math.round((thisClose - lastClose) * 100) / 100,
                        price_change_percent: Math.round(((thisClose - lastClose) / lastClose * 100) * 100) / 100,
                        volume_change_percent: Math.round(((thisVolume - lastVolume) / lastVolume * 100) * 100) / 100,
                        previous_day_decline: Math.round(((lastClose - dayBeforeLastClose) / dayBeforeLastClose * 100) * 100) / 100
                    });
                }
            } catch (error) {
                console.error(`Error processing stock ${stockInfo.code}:`, error.message);
                continue;
            }
        }
        
        results.sort((a, b) => b.price_change_percent - a.price_change_percent);
        
        const marketStats = results.reduce((acc, stock) => {
            acc[stock.market] = (acc[stock.market] || 0) + 1;
            return acc;
        }, {});
        
        return res.status(200).json({
            message: 'Advanced detection completed successfully',
            data: results,
            summary: {
                total: results.length,
                marketStats: marketStats,
                date: adjustedDate,
                originalDate: dateAdjusted ? formattedDate : undefined,
                dateAdjusted: dateAdjusted,
                previousDate: previousDate,
                dayBeforePrevious: dayBeforePrevious,
                processedStocks: processedCount,
                validDataStocks: validDataCount,
                volumeFilteredStocks: volumeFilteredCount,
                minVolumeFilter: volumeFilter
            },
            success: true
        });
        
    } catch (error) {
        console.error('Error in detectVolumeDecPriceRiseAdvanced:', error.message);
        return res.status(500).json({ 
            message: errorHandler(error), 
            success: false 
        });
    }
};

module.exports = {
    createJumps,
    getAllJumps,
    updateJumpRecord,
    deleteJump,
    deleteJumpsRecord,
    updateIfClosed,
    deleteJumpsRecords,
    getJumpRecord,
    bulkDeleteJumps,
    detectVolumeDecPriceRiseAdvanced
};