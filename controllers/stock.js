const { Stock } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const axios = require('axios');
const { stock_codes } = require('../saveData');

const header = {
    accept: '*/*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    cookie: 'A3=d=AQABBOGBUGQCEP6cgdsdSEF1dvVn1mTfaU8FEgEBAQHTUWRaZL2oQDIB_eMAAA&S=AQAAAmEM9Ji_q1hxehjb6NgQl8k',
    referer: 'https://s.yimg.com/nb/tw_stock_frontend/scripts/TaChart/tachart.14b50e7f13.html?sid=6138&w=868',
    'sec-ch-ua': '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'script',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
    'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
};

async function fetchData(codeArray) {
    const yahooStockUrl = `https://tw.quote.finance.yahoo.net/quote/q?type=ta&perd=d&mkt=10&sym=${codeArray.code}&v=1&callback=test123`;
    try {
        const response = await axios.get(yahooStockUrl, { headers: header });
        const jsonpData = response.data;
        const startIndex = jsonpData.indexOf('{');
        const endIndex = jsonpData.lastIndexOf('}');
        const jsonData = jsonpData.substring(startIndex, endIndex + 1);
        const jsonFinal = JSON.parse(jsonData);
        const dictData = jsonFinal.ta;
        if (dictData && dictData.length > 2) {
            const _this = dictData[dictData.length - 1];
            const this_close = _this.c;
            let success = {
                code: codeArray.code,
                name: codeArray.name,
                industry: codeArray.industry,
                price: this_close.toString(),
            };
            // console.log('success', success);
            return success;
        }
        // console.log('null', codeArray);
        return null;
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
        const stocks = await Stock.findAll({ attributes: ['code', 'name','price'] });
        const stockCodes = stocks.map((stock) => {
            
            return { code: stock.code, name: stock.name, price:stock.price};
        });
        return res.status(200).json({ data: stockCodes, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    createStocks,
    getAllStockCodes,
};
