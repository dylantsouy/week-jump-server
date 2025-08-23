const { Jump, JumpsRecord, Stock } = require('../models');
const axios = require('axios');
const { stock_codes } = require('../saveData');
const { errorHandler } = require('../helpers/responseHelper');
const moment = require('moment');
const iconv = require('iconv-lite'); // 需要安裝: npm install iconv-lite

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
                continue; // 跳過解析錯誤的資料
            }
        }

        return stockData;
    } catch (error) {
        console.error(`Error fetching TWSE data for ${date}:`, error.message);
        return {};
    }
}

// 獲取週線/月線需要的完整交易日期範圍
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

                // 跳過週末
                if (date.day() === 0 || date.day() === 6) continue;

                // 本週不要超過目標日期
                if (week === 0 && date.isAfter(target)) continue;

                dates.push({
                    date: date.format('YYYYMMDD'),
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
                // 跳過週末
                if (currentDay.day() !== 0 && currentDay.day() !== 6) {
                    // 本月不要超過目標日期
                    if (month === 0 && currentDay.isAfter(target)) {
                        break;
                    }

                    dates.push({
                        date: currentDay.format('YYYYMMDD'),
                        month: month === 0 ? 'thisMonth' : 'lastMonth',
                        monthStart: monthStart.format('YYYYMMDD'),
                    });
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
        t: sortedData[0].t, // 使用第一個交易日作為週期標記
        o: sortedData[0].o, // 週開盤 = 第一個交易日開盤
        h: Math.max(...sortedData.map((d) => d.h)), // 週最高 = 所有交易日最高價
        l: Math.min(...sortedData.map((d) => d.l)), // 週最低 = 所有交易日最低價
        c: sortedData[sortedData.length - 1].c, // 週收盤 = 最後一個交易日收盤
        v: sortedData.reduce((sum, d) => sum + d.v, 0), // 週成交量 = 累加
    };

    return weeklyK;
}

// 合併月線K線資料
function aggregateToMonthlyKLine(dailyDataArray) {
    if (!dailyDataArray || dailyDataArray.length === 0) return null;

    // 按日期排序
    const sortedData = dailyDataArray.sort((a, b) => parseInt(a.t) - parseInt(b.t));

    const monthlyK = {
        t: sortedData[0].t, // 使用第一個交易日作為月期標記
        o: sortedData[0].o, // 月開盤 = 第一個交易日開盤
        h: Math.max(...sortedData.map((d) => d.h)), // 月最高 = 所有交易日最高價
        l: Math.min(...sortedData.map((d) => d.l)), // 月最低 = 所有交易日最低價
        c: sortedData[sortedData.length - 1].c, // 月收盤 = 最後一個交易日收盤
        v: sortedData.reduce((sum, d) => sum + d.v, 0), // 月成交量 = 累加
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
        const allMarketData = new Map(); // date -> { stockCode: data }

        // 去重日期
        const uniqueDates = [...new Set(tradingDateDetails.map((d) => d.date))];

        for (const tradingDate of uniqueDates) {
            console.log(`Fetching market data for ${tradingDate}...`);
            const dailyMarketData = await fetchTWSEDailyData(tradingDate);
            allMarketData.set(tradingDate, dailyMarketData);

            // 請求間隔，避免被封鎖
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        console.log(`Market data fetched. Processing ${targets.length} stocks...`);

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
                    continue; // 沒有資料的股票跳過
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
                    continue; // 無法生成完整K線的股票跳過
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

                // 跳空檢測邏輯 - 週K/月K vs 上週K/上月K
                const last_value = parseInt(Math.round(lastK.v / 1000));
                const this_open = Math.round(thisK.o * 100) / 100;
                const this_low = Math.round(thisK.l * 100) / 100;
                const last_high = Math.round(lastK.h * 100) / 100;

                // 向上跳空條件：本週/月開盤價 > 上週/月最高價
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
                    });

                    console.log(
                        `${perd.toUpperCase()} Jump found for ${
                            target.code
                        }: Last ${perd}K High=${last_high} -> This ${perd}K Open=${this_open}`
                    );
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
        const { perd, date } = req.body;
        if (!perd || !date) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        if (!['w', 'm'].includes(perd)) {
            return res.status(400).json({ message: 'perd must be "w" or "m"', success: false });
        }

        console.log(
            `Starting ${perd === 'w' ? 'weekly' : 'monthly'} K-line jump detection for ${stock_codes.length} stocks...`
        );

        // 使用優化後的批量處理
        const data = await fetchOptimizedBatchData(stock_codes, perd, date);

        console.log(`${perd.toUpperCase()}-line jump detection completed. Found ${data.length} jump signals.`);

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
            return res.status(400).json({ message: 'No new jumps created', success: false });
        }
        return res.status(200).json({
            message: 'Successful Created',
            newJumps: createdJumps,
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
};
