const { Stock, Loan } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://fubon-ebrokerdj.fbs.com.tw'
};

async function fetchLoanRankingData() {
    try {
        const response = await axios.get('https://fubon-ebrokerdj.fbs.com.tw/Z/ZG/ZG_E.djhtm', {
            headers: headers
        });

        const $ = cheerio.load(response.data);
        
        const recordDate = dayjs().format('YYYY-MM-DD');
        
        const loanData = [];

        $('table.t01 tr').each((index, element) => {
            if (index === 0 || $(element).find('td').length === 0) {
                return;
            }

            const tds = $(element).find('td');
            
            if (tds.length < 6) {
                return;
            }

            const stockText = $(tds[1]).text().trim();
            const codeMatch = stockText.match(/\((\d+)\)/);
            
            if (!codeMatch) {
                return;
            }
            
            const stockCode = codeMatch[1];
            
            const previousBalance = parseInt($(tds[2]).text().trim().replace(/,/g, ''), 10) || 0;
            const currentBalance = parseInt($(tds[3]).text().trim().replace(/,/g, ''), 10) || 0;
            const change = parseInt($(tds[4]).text().trim().replace(/,/g, ''), 10) || 0;

            loanData.push({
                stockCode,
                previousBalance,
                currentBalance,
                change,
                recordDate
            });
        });

        return loanData;
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
}

const createLoanRankings = async (req, res) => {
    try {
        const loanData = await fetchLoanRankingData();
        
        if (!loanData.length) {
            return res.status(400).json({ message: 'error', success: false });
        }

        const stockCodes = loanData.map(item => item.stockCode);
        const existingStocks = await Stock.findAll({
            where: {
                code: stockCodes
            },
            attributes: ['code']
        });

        const existingStockCodes = existingStocks.map(stock => stock.code);
        const nonExistingStockCodes = stockCodes.filter(code => !existingStockCodes.includes(code));

        if (nonExistingStockCodes.length > 0) {
            console.log(`error: ${nonExistingStockCodes.join(', ')}`);
        }

        const filteredLoanData = loanData.filter(item => existingStockCodes.includes(item.stockCode));
        
        await Loan.bulkCreate(filteredLoanData);

        return res.status(200).json({ 
            message: 'Successful Created', 
            success: true,
            count: filteredLoanData.length
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    fetchLoanRankingData,
    createLoanRankings
};