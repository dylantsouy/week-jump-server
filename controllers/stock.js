const { Stock } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const axios = require('axios');
const { stock_codes } = require('../saveData');
const iconv = require('iconv-lite'); // 需要安裝: npm install iconv-lite
const moment = require('moment');

// 解析 CSV 數據的輔助函數（重用之前的函數）
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

// 從台灣證交所獲取單日所有股票資料（重用之前的函數）
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
                
                if (close > 0) { // 只需要收盤價大於0即可
                    stockData[stockCode] = {
                        code: stockCode,
                        name: stockName,
                        price: close,
                        open: open,
                        high: high,
                        low: low,
                        volume: volume,
                        date: date
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

// 獲取最新交易日
function getLatestTradingDate() {
    const today = moment();
    let tradingDate = today.clone();
    
    // 往前找最近的交易日（避開週末）
    while (tradingDate.day() === 0 || tradingDate.day() === 6) {
        tradingDate.subtract(1, 'day');
    }
    
    return tradingDate.format('YYYYMMDD');
}

// 批量獲取所有股票資料的優化版本
async function fetchBatchStockData(targetStocks) {
    try {
        const latestDate = getLatestTradingDate();
        console.log(`Fetching stock data for date: ${latestDate}`);
        
        // 一次性獲取所有股票資料
        const allStockData = await fetchTWSEDailyData(latestDate);
        
        if (Object.keys(allStockData).length === 0) {
            console.warn('No stock data retrieved from TWSE');
            return [];
        }
        
        // 從目標股票清單中提取需要的資料
        const results = [];
        
        for (const targetStock of targetStocks) {
            const stockData = allStockData[targetStock.code];
            
            if (stockData) {
                results.push({
                    code: stockData.code,
                    name: stockData.name || targetStock.name, // 優先使用證交所的名稱，沒有則用原本的
                    industry: targetStock.industry, // industry 資訊證交所沒有，保持原本的
                    price: stockData.price.toString(),
                });
            } else {
                console.warn(`Stock ${targetStock.code} not found in TWSE data`);
                // 可以選擇是否要保留原本的資料或跳過
                results.push({
                    code: targetStock.code,
                    name: targetStock.name,
                    industry: targetStock.industry,
                    price: '0', // 或者可以保持原本的價格不變
                });
            }
        }
        
        console.log(`Successfully processed ${results.length} stocks`);
        return results;
        
    } catch (error) {
        console.error('Error in fetchBatchStockData:', error);
        return [];
    }
}

// 優化後的 createStocks 函數
const createStocks = async (req, res) => {
    try {
        console.log(`Starting batch processing for ${stock_codes.length} stocks...`);
        
        // 使用批量處理獲取所有股票資料
        const data = await fetchBatchStockData(stock_codes);
        
        if (!data.length) {
            return res.status(400).json({ message: 'No data retrieved', success: false });
        }
        
        // 批量更新資料庫
        await Stock.bulkCreate(data, { 
            updateOnDuplicate: ['price', 'updatedAt', 'industry', 'name']
        });
        
        console.log('Stock data updated successfully');
        return res.status(200).json({ 
            message: 'Successful Created', 
            updatedCount: data.length,
            success: true 
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllStockCodes = async (req, res) => {
    try {
        const stocks = await Stock.findAll({ attributes: ['code', 'name', 'price'] });
        const stockCodes = stocks.map((stock) => {
            return { code: stock.code, name: stock.name, price: stock.price };
        });
        return res.status(200).json({ data: stockCodes, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 檢查股票是否存在於台灣證交所（替代原本的 Yahoo Finance 檢查）
const checkStocks = async (req, res) => {
    try {
        console.log('Checking stocks availability in TWSE...');
        
        // 獲取最新的證交所資料
        const latestDate = getLatestTradingDate();
        const allStockData = await fetchTWSEDailyData(latestDate);
        
        const updatedStocks = [];
        
        for (const stock of stock_codes) {
            const twseData = allStockData[stock.code];
            
            if (twseData) {
                // 股票存在於證交所
                updatedStocks.push({
                    ...stock,
                    Market: 'TWSE', // 台灣證交所
                    available: true,
                    currentPrice: twseData.price,
                    lastUpdated: latestDate
                });
            } else {
                // 股票不存在於證交所資料中
                updatedStocks.push({
                    ...stock,
                    Market: 'Unknown',
                    available: false,
                    currentPrice: null,
                    lastUpdated: latestDate
                });
            }
        }
        
        // 統計資訊
        const availableCount = updatedStocks.filter(stock => stock.available).length;
        const unavailableCount = updatedStocks.length - availableCount;
        
        console.log(`Check completed: ${availableCount} available, ${unavailableCount} unavailable`);
        
        res.json({
            success: true,
            summary: {
                total: updatedStocks.length,
                available: availableCount,
                unavailable: unavailableCount,
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

// 新增：獲取特定股票的詳細資訊
const getStockDetail = async (req, res) => {
    try {
        const { code } = req.params;
        
        if (!code) {
            return res.status(400).json({ 
                message: 'Stock code is required', 
                success: false 
            });
        }
        
        const latestDate = getLatestTradingDate();
        const allStockData = await fetchTWSEDailyData(latestDate);
        const stockData = allStockData[code];
        
        if (!stockData) {
            return res.status(404).json({ 
                message: 'Stock not found', 
                success: false 
            });
        }
        
        return res.status(200).json({ 
            data: stockData, 
            success: true 
        });
        
    } catch (error) {
        return res.status(500).json({ 
            message: errorHandler(error), 
            success: false 
        });
    }
};

module.exports = {
    createStocks,
    getAllStockCodes,
    checkStocks,
    getStockDetail,
};