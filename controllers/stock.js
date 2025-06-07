const { Stock } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const axios = require('axios');
const { stock_codes } = require('../saveData');

async function fetchData(codeArray) {
    const yahooStockUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${codeArray.code}.${codeArray.Market}`;
    try {
        const response = await axios.get(yahooStockUrl);
        const result = response.data.chart.result[0];
        const latestPrice = result.meta.regularMarketPrice;
        let success = {
            code: codeArray.code,
            name: codeArray.name,
            industry: codeArray.industry,
            price: latestPrice.toString(),
        };

        return success;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

const createStocks = async (req, res) => {
    try {
        
        const data = [];
        for (const codeArray of stock_codes) {
            
            const result = await fetchData(codeArray);
            if (result) {
                data.push(result);
            }
        }
        if (!data.length) {
            return res.status(400).json({ message: 'No data retrieved', success: false });
        }
        await Stock.bulkCreate(data, { updateOnDuplicate: ['price', 'updatedAt', 'industry'] });
        return res.status(200).json({ message: 'Successful Created', success: true });
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

const checkStocks = async (req, res) => {
    try {
        const updatedStocks = []; // 初始化結果陣列
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // 分批處理，每批 50 個股票
        for (let i = 0; i < stock_codes.length; i += 50) {
            const batch = stock_codes.slice(i, i + 50);
            const batchPromises = batch.map(async (stock) => {
                const market = await checkMarket(stock.code);
                return { ...stock, Market: market };
            });
            const batchResults = await Promise.all(batchPromises);
            updatedStocks.push(...batchResults);
            await delay(1000); // 每批次間隔 1 秒
        }

        // 回傳更新後的列表
        res.json(updatedStocks);
    } catch (error) {
        console.error('Error processing stock codes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
async function checkMarket(code) {
    const twUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.TW`;
    const twoUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.TWO`;

    try {
        // 檢查 TW (上市)
        const twResponse = await axios.get(twUrl);
        if (twResponse.status === 200) {
            return 'TW';
        }
    } catch (error) {}

    try {
        const twoResponse = await axios.get(twoUrl);
        if (twoResponse.status === 200) {
            return 'TWO';
        }
    } catch (error) {}

    return 'Unknown'; // 如果 TW 和 TWO 都無效
}
module.exports = {
    createStocks,
    getAllStockCodes,
    checkStocks,
};
