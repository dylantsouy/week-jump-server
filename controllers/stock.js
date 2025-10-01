const { Stock } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const axios = require('axios');
const { stock_codes } = require('../saveData');
const iconv = require('iconv-lite');
const moment = require('moment');

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

// 從台灣證交所獲取資料
async function fetchTWSEDailyData(date) {
    try {
        const url = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=csv&date=${date}&type=ALL`;
        
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000
        });
        
        const csvData = iconv.decode(response.data, 'big5');
        const lines = csvData.split('\n').filter(line => line.trim());
        
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
                const stockName = fields[1]?.replace(/"/g, '').trim() || '';
                const volume = parseInt(fields[2]?.replace(/[",]/g, '')) || 0;
                const open = parseFloat(fields[5]?.replace(/[",]/g, '')) || 0;
                const high = parseFloat(fields[6]?.replace(/[",]/g, '')) || 0;
                const low = parseFloat(fields[7]?.replace(/[",]/g, '')) || 0;
                const close = parseFloat(fields[8]?.replace(/[",]/g, '')) || 0;
                
                if (close > 0) {
                    stockData[stockCode] = {
                        code: stockCode,
                        name: stockName,
                        price: close,
                        open: open,
                        high: high,
                        low: low,
                        volume: volume,
                        date: date,
                        market: 'TWSE'
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

// 備用 API 也更新為新格式
async function fetchOTCDailyDataAlternative(date) {
    try {
        // console.log(`Trying alternative OTC API for date: ${date}`);
        
        // 方法1: 使用不同的 API 端點
        const url1 = `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&d=${date}`;
        
        // console.log(`Alternative OTC API URL: ${url1}`);
        
        const response = await axios.get(url1, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.tpex.org.tw/'
            }
        });
        
        // console.log('Alternative OTC API Response Status:', response.status);
        
        if (!response.data) {
            console.warn('Alternative OTC API returned no data');
            return {};
        }
        
        const stockData = {};
        let jsonData = response.data;
        
        if (typeof response.data === 'string') {
            try {
                jsonData = JSON.parse(response.data);
            } catch (parseError) {
                console.error('Failed to parse alternative OTC response:', parseError.message);
                return {};
            }
        }
        
        // console.log('Alternative OTC JSON structure:', Object.keys(jsonData));
        
        // 處理新的 tables 格式
        if (jsonData.tables && Array.isArray(jsonData.tables) && jsonData.tables.length > 0) {
            const table = jsonData.tables[0];
            // console.log(`Found ${table.data?.length || 0} records in alternative API`);
            
            if (table.data && Array.isArray(table.data)) {
                for (const row of table.data) {
                    try {
                        if (!Array.isArray(row) || row.length < 3) continue;
                        
                        const stockCode = row[0]?.toString().trim();
                        if (!stockCode || !/^\d{4}$/.test(stockCode)) continue;
                        
                        const stockName = row[1]?.toString().trim() || '';
                        const close = parseFloat(row[2]?.toString().replace(/[,\s]/g, '')) || 0;
                        
                        if (close > 0) {
                            stockData[stockCode] = {
                                code: stockCode,
                                name: stockName,
                                price: close,
                                open: close, // 如果沒有開盤價，用收盤價
                                high: close,
                                low: close,
                                volume: 0,
                                date: date,
                                market: 'OTC'
                            };
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
        }
        // 舊格式向下相容
        else if (jsonData.aaData && Array.isArray(jsonData.aaData)) {
            // console.log(`Found ${jsonData.aaData.length} records in alternative API (old format)`);
            
            for (const row of jsonData.aaData) {
                try {
                    if (!Array.isArray(row) || row.length < 8) continue;
                    
                    const stockCode = row[0]?.toString().trim();
                    if (!stockCode || !/^\d{4}$/.test(stockCode)) continue;
                    
                    const stockName = row[1]?.toString().trim() || '';
                    const close = parseFloat(row[2]?.toString().replace(/[,\s]/g, '')) || 0;
                    
                    if (close > 0) {
                        stockData[stockCode] = {
                            code: stockCode,
                            name: stockName,
                            price: close,
                            open: close,
                            high: close,
                            low: close,
                            volume: 0,
                            date: date,
                            market: 'OTC'
                        };
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        
        // console.log(`Alternative API processed ${Object.keys(stockData).length} OTC stocks`);
        return stockData;
        
    } catch (error) {
        console.error('Alternative OTC API error:', error.message);
        return {};
    }
}

// 修改原始的 OTC 函數，加入備用方法
async function fetchOTCDailyData(date) {
    // 先嘗試原始 API
    let stockData = await fetchOTCDailyDataOriginal(date);
    
    // 如果原始 API 沒有資料，嘗試備用 API
    if (Object.keys(stockData).length === 0) {
        // console.log('Original OTC API failed, trying alternative...');
        stockData = await fetchOTCDailyDataAlternative(date);
    }
    
    return stockData;
}

// 修正版本：處理新的櫃買中心 API 格式
async function fetchOTCDailyDataOriginal(date) {
    try {
        // console.log(`Fetching OTC data for date: ${date}`);
        
        // 櫃買中心的 API 格式
        const url = `https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d=${date}&se=AL`;
        // console.log(`OTC API URL: ${url}`);
        
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
        
        // console.log('OTC API Response Status:', response.status);
        // console.log('OTC API Response Data Type:', typeof response.data);
        
        // 檢查回應資料
        if (!response.data) {
            console.warn('OTC API returned no data');
            return {};
        }
        
        const stockData = {};
        
        // 處理不同的回應格式
        let jsonData = response.data;
        if (typeof response.data === 'string') {
            try {
                jsonData = JSON.parse(response.data);
            } catch (parseError) {
                console.error('Failed to parse OTC response as JSON:', parseError.message);
                // console.log('Raw response (first 500 chars):', response.data.substring(0, 500));
                return {};
            }
        }
        
        // 檢查資料結構 - 新格式使用 tables
        // console.log('OTC JSON structure:', Object.keys(jsonData));
        
        // 處理新的 tables 格式
        if (jsonData.tables && Array.isArray(jsonData.tables) && jsonData.tables.length > 0) {
            const table = jsonData.tables[0]; // 取第一個表格
            // console.log(`Found OTC table with ${table.totalCount} total records`);
            // console.log(`Table fields:`, table.fields);
            
            if (table.data && Array.isArray(table.data)) {
                // console.log(`Processing ${table.data.length} OTC data records`);
                
                for (const row of table.data) {
                    try {
                        if (!Array.isArray(row) || row.length < 8) {
                            continue;
                        }
                        
                        // 根據新格式的欄位順序解析
                        // ["代號","名稱","收盤 ","漲跌","開盤 ","最高 ","最低","成交股數  "," 成交金額(元)"," 成交筆數 ",...]
                        const stockCode = row[0]?.toString().trim();
                        if (!stockCode || !/^\d{4}$/.test(stockCode)) continue;
                        
                        const stockName = row[1]?.toString().trim() || '';
                        const closeStr = row[2]?.toString().replace(/[,\s]/g, '') || '0';
                        const changeStr = row[3]?.toString().replace(/[+,\s]/g, '') || '0';
                        const openStr = row[4]?.toString().replace(/[,\s]/g, '') || '0';
                        const highStr = row[5]?.toString().replace(/[,\s]/g, '') || '0';
                        const lowStr = row[6]?.toString().replace(/[,\s]/g, '') || '0';
                        const volumeStr = row[7]?.toString().replace(/[,\s]/g, '') || '0';
                        
                        const close = parseFloat(closeStr) || 0;
                        const change = parseFloat(changeStr) || 0;
                        const open = parseFloat(openStr) || 0;
                        const high = parseFloat(highStr) || 0;
                        const low = parseFloat(lowStr) || 0;
                        const volume = parseInt(volumeStr) || 0;
                        
                        if (close > 0) {
                            stockData[stockCode] = {
                                code: stockCode,
                                name: stockName,
                                price: close,
                                change: change,
                                open: open,
                                high: high,
                                low: low,
                                volume: volume,
                                date: date,
                                market: 'OTC'
                            };
                        }
                    } catch (error) {
                        console.error(`Error processing OTC row:`, error.message);
                        continue;
                    }
                }
            }
        }
        // 嘗試舊格式 aaData（向下相容）
        else if (jsonData.aaData && Array.isArray(jsonData.aaData)) {
            // console.log(`Found ${jsonData.aaData.length} OTC records (old format)`);
            
            for (const row of jsonData.aaData) {
                try {
                    if (!Array.isArray(row) || row.length < 8) {
                        continue;
                    }
                    
                    const stockCode = row[0]?.toString().trim();
                    if (!stockCode || !/^\d{4}$/.test(stockCode)) continue;
                    
                    const stockName = row[1]?.toString().trim() || '';
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
                    
                    if (close > 0) {
                        stockData[stockCode] = {
                            code: stockCode,
                            name: stockName,
                            price: close,
                            open: open,
                            high: high,
                            low: low,
                            volume: volume,
                            date: date,
                            market: 'OTC'
                        };
                    }
                } catch (error) {
                    console.error(`Error processing OTC row (old format):`, error.message);
                    continue;
                }
            }
        } else {
            console.warn('OTC API response missing both tables and aaData');
            // console.log('Available keys:', Object.keys(jsonData));
            
            // 檢查是否有錯誤訊息
            if (jsonData.stat && jsonData.stat !== 'OK') {
                console.error('OTC API returned error status:', jsonData.stat);
            }
        }
        
        // console.log(`Processed ${Object.keys(stockData).length} OTC stocks`);
        return stockData;
        
    } catch (error) {
        console.error(`Error fetching OTC data for ${date}:`, error.message);
        if (error.response) {
            console.error('OTC API Error Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data ? error.response.data.substring(0, 200) : 'No data'
            });
        }
        return {};
    }
}

// 獲取最新交易日
function getLatestTradingDate() {
    const today = moment();
    let tradingDate = today.clone();
    
    while (tradingDate.day() === 0 || tradingDate.day() === 6) {
        tradingDate.subtract(1, 'day');
    }
    
    return tradingDate.format('YYYYMMDD');
}

// 格式化櫃買中心日期 - 改善版本
function formatDateForOTC(date) {
    try {
        // 櫃買中心需要 111/12/31 格式 (民國年)
        const year = parseInt(date.substring(0, 4));
        const month = date.substring(4, 6);
        const day = date.substring(6, 8);
        const rocYear = year - 1911; // 轉換為民國年
        
        const formattedDate = `${rocYear}/${month}/${day}`;
        // console.log(`Date conversion: ${date} -> ${formattedDate}`);
        
        return formattedDate;
    } catch (error) {
        console.error('Error formatting date for OTC:', error.message);
        return date;
    }
}

// 優化版本：根據 Market 欄位分別獲取資料
async function fetchBatchStockData(targetStocks) {
    try {
        const latestDate = getLatestTradingDate();
        // console.log(`Fetching stock data for date: ${latestDate}`);
        
        // 根據 Market 欄位分組
        const twseStocks = targetStocks.filter(stock => stock.Market === 'TW');
        const otcStocks = targetStocks.filter(stock => stock.Market === 'TWO');
        // const unknownStocks = targetStocks.filter(stock => !stock.Market || (stock.Market !== 'TW' && stock.Market !== 'TWO'));
        
        // console.log(`TWSE stocks: ${twseStocks.length}, OTC stocks: ${otcStocks.length}, Unknown: ${unknownStocks.length}`);
        
        const allStockData = {};
        
        // 只在有對應股票時才呼叫相應的 API
        const promises = [];
        
        if (twseStocks.length > 0) {
            promises.push(
                fetchTWSEDailyData(latestDate).then(data => {
                    Object.assign(allStockData, data);
                    // console.log(`Retrieved ${Object.keys(data).length} TWSE stocks`);
                })
            );
        }
        
        if (otcStocks.length > 0) {
            promises.push(
                fetchOTCDailyData(formatDateForOTC(latestDate)).then(data => {
                    Object.assign(allStockData, data);
                    // console.log(`Retrieved ${Object.keys(data).length} OTC stocks`);
                })
            );
        }
        
        // 等待所有 API 完成
        await Promise.all(promises);
        
        if (Object.keys(allStockData).length === 0) {
            console.warn('No stock data retrieved');
            return [];
        }
        
        const results = [];
        
        for (const targetStock of targetStocks) {
            const stockData = allStockData[targetStock.code];
            
            if (stockData) {
                results.push({
                    code: stockData.code,
                    name: stockData.name || targetStock.name,
                    industry: targetStock.industry,
                    price: stockData.price.toString(),
                    market: targetStock.Market // 使用原始的 Market 欄位
                });
            } else {
                console.warn(`Stock ${targetStock.code} (${targetStock.Market}) not found`);
                results.push({
                    code: targetStock.code,
                    name: targetStock.name,
                    industry: targetStock.industry,
                    price: '0',
                    market: targetStock.Market || 'Unknown'
                });
            }
        }
        
        // console.log(`Successfully processed ${results.length} stocks`);
        return results;
        
    } catch (error) {
        console.error('Error in fetchBatchStockData:', error);
        return [];
    }
}

// 優化後的 createStocks 函數
const createStocks = async (req, res) => {
    try {
        // console.log(`Starting batch processing for ${stock_codes.length} stocks...`);
        
        const data = await fetchBatchStockData(stock_codes);
        
        if (!data.length) {
            return res.status(400).json({ message: 'No data retrieved', success: false });
        }
        
        await Stock.bulkCreate(data, { 
            updateOnDuplicate: ['price', 'updatedAt', 'industry', 'name', 'market']
        });
        
        // 統計各市場的股票數量
        const marketStats = data.reduce((acc, stock) => {
            acc[stock.market] = (acc[stock.market] || 0) + 1;
            return acc;
        }, {});
        
        // console.log('Stock data updated successfully');
        // console.log('Market distribution:', marketStats);
        
        return res.status(200).json({ 
            message: 'Successful Created', 
            updatedCount: data.length,
            marketStats: marketStats,
            success: true 
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllStockCodes = async (req, res) => {
    try {
        const stocks = await Stock.findAll({ 
            attributes: ['code', 'name', 'price', 'market'] 
        });
        const stockCodes = stocks.map((stock) => {
            return { 
                code: stock.code, 
                name: stock.name, 
                price: stock.price,
                market: stock.market || 'Unknown'
            };
        });
        return res.status(200).json({ data: stockCodes, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 更新後的檢查函數 - 根據 Market 欄位優化
const checkStocks = async (req, res) => {
    try {
        // console.log('Checking stocks availability based on Market field...');
        
        const latestDate = getLatestTradingDate();
        
        // 根據 Market 欄位分組
        const twseStocks = stock_codes.filter(stock => stock.Market === 'TW');
        const otcStocks = stock_codes.filter(stock => stock.Market === 'TWO');
        const unknownStocks = stock_codes.filter(stock => !stock.Market || (stock.Market !== 'TW' && stock.Market !== 'TWO'));
        
        // console.log(`Checking: ${twseStocks.length} TWSE, ${otcStocks.length} OTC, ${unknownStocks.length} Unknown stocks`);
        
        const allStockData = {};
        
        // 只在有對應股票時才呼叫相應的 API
        const promises = [];
        
        if (twseStocks.length > 0) {
            promises.push(
                fetchTWSEDailyData(latestDate).then(data => {
                    Object.assign(allStockData, data);
                })
            );
        }
        
        if (otcStocks.length > 0) {
            promises.push(
                fetchOTCDailyData(formatDateForOTC(latestDate)).then(data => {
                    Object.assign(allStockData, data);
                })
            );
        }
        
        await Promise.all(promises);
        
        const updatedStocks = [];
        
        for (const stock of stock_codes) {
            const stockData = allStockData[stock.code];
            
            if (stockData) {
                updatedStocks.push({
                    ...stock,
                    Market: stock.Market, // 保持原始的 Market 標識
                    available: true,
                    currentPrice: stockData.price,
                    lastUpdated: latestDate,
                    actualMarket: stockData.market // API 回傳的市場資訊
                });
            } else {
                updatedStocks.push({
                    ...stock,
                    Market: stock.Market || 'Unknown',
                    available: false,
                    currentPrice: null,
                    lastUpdated: latestDate,
                    actualMarket: null
                });
            }
        }
        
        const availableCount = updatedStocks.filter(stock => stock.available).length;
        const unavailableCount = updatedStocks.length - availableCount;
        
        // 統計各市場的成功率
        const marketStats = {
            TW: {
                total: twseStocks.length,
                found: updatedStocks.filter(s => s.Market === 'TW' && s.available).length
            },
            TWO: {
                total: otcStocks.length,
                found: updatedStocks.filter(s => s.Market === 'TWO' && s.available).length
            },
            Unknown: {
                total: unknownStocks.length,
                found: updatedStocks.filter(s => (!s.Market || (s.Market !== 'TW' && s.Market !== 'TWO')) && s.available).length
            }
        };
        
        res.json({
            success: true,
            summary: {
                total: updatedStocks.length,
                available: availableCount,
                unavailable: unavailableCount,
                marketStats: marketStats,
                checkDate: latestDate
            },
            stocks: updatedStocks
        });
        
    } catch (error) {
        console.error('Error checking stock availability:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            message: error.message 
        });
    }
};

// 根據 Market 欄位獲取特定股票詳細資訊
const getStockDetail = async (req, res) => {
    try {
        const { code } = req.params;
        
        if (!code) {
            return res.status(400).json({ 
                message: 'Stock code is required', 
                success: false 
            });
        }
        
        // 從 saveData 中找到股票的 Market 資訊
        const stockInfo = stock_codes.find(stock => stock.code === code);
        if (!stockInfo) {
            return res.status(404).json({ 
                message: 'Stock code not found in our database', 
                success: false 
            });
        }
        
        const latestDate = getLatestTradingDate();
        let stockData = null;
        
        // 根據 Market 欄位決定從哪個 API 獲取
        if (stockInfo.Market === 'TW') {
            const twseData = await fetchTWSEDailyData(latestDate);
            stockData = twseData[code];
        } else if (stockInfo.Market === 'TWO') {
            const otcData = await fetchOTCDailyData(formatDateForOTC(latestDate));
            stockData = otcData[code];
        } else {
            // 如果 Market 未知，嘗試兩個市場
            const [twseData, otcData] = await Promise.all([
                fetchTWSEDailyData(latestDate),
                fetchOTCDailyData(formatDateForOTC(latestDate))
            ]);
            stockData = twseData[code] || otcData[code];
        }
        
        if (!stockData) {
            return res.status(404).json({ 
                message: `Stock ${code} not found in ${stockInfo.Market || 'any'} market`, 
                success: false 
            });
        }
        
        // 加入原始的股票資訊
        const enrichedData = {
            ...stockData,
            originalMarket: stockInfo.Market,
            industry: stockInfo.industry
        };
        
        return res.status(200).json({ 
            data: enrichedData, 
            success: true 
        });
        
    } catch (error) {
        return res.status(500).json({ 
            message: errorHandler(error), 
            success: false 
        });
    }
};

// 新增：測試櫃買中心 API 的函數
const testOTCAPI = async (req, res) => {
    try {
        const latestDate = getLatestTradingDate();
        const otcDate = formatDateForOTC(latestDate);
        
        // console.log(`Testing OTC API with date: ${otcDate}`);
        
        const stockData = await fetchOTCDailyData(otcDate);
        
        const sampleCodes = ['6968', '6739', '7584']; // 您的範例股票
        const foundStocks = sampleCodes.map(code => ({
            code: code,
            found: !!stockData[code],
            data: stockData[code] || null
        }));
        
        return res.status(200).json({
            success: true,
            testDate: {
                original: latestDate,
                formatted: otcDate
            },
            totalFound: Object.keys(stockData).length,
            sampleStocks: foundStocks,
            firstFewStocks: Object.values(stockData).slice(0, 5) // 前5筆資料作為範例
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    createStocks,
    getAllStockCodes,
    checkStocks,
    getStockDetail,
    testOTCAPI, // 新增測試函數
};