const { Stock, Loan } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://fubon-ebrokerdj.fbs.com.tw'
};

const istockHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.istock.tw'
};
async function fetchLoanRankingData(type) {
    try {
        let url = type === 'TWSE' ? 'https://fubon-ebrokerdj.fbs.com.tw/Z/ZG/ZG_E.djhtm' : 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_E_1_1.djhtm'
        const response = await axios.get(url, {
            headers: headers
        });

        const $ = cheerio.load(response.data);

        const loanData = [];
        let dateText = $('.t11').text();
        let date = dateText.slice(5,10);
        let today = new Date();
        let dayOfWeek = today.getDay(); 

        if (dayOfWeek === 6) {
            today.setDate(today.getDate() - 1); 
        } else if (dayOfWeek === 0) {
            today.setDate(today.getDate() - 2); 
        }
        let todayMonth = String(today.getMonth() + 1).padStart(2, '0'); 
        let todayDay = String(today.getDate()).padStart(2, '0'); 
        let todayFormatted = `${todayMonth}/${todayDay}`;

        if (date !== todayFormatted) {
            console.log('日期不匹配，停止執行。');
            return;
        }
        $('table.t01 tr').each((index, element) => {
            if (index === 0 || $(element).find('td').length === 0) {
                return;
            }

            const tds = $(element).find('td');

            if (tds.length < 6) {
                return;
            }

            const stockText = $(tds[1]).text().trim();
            const codeMatch = stockText.split(' ');

            if (!codeMatch) {
                return;
            }

            const stockCode = codeMatch[0];
            if (stockCode.length > 4) {
                return;
            }
            const initPrice = +$(tds[2]).text() || 0;
            const previousBalance = parseInt($(tds[5]).text().trim().replace(/,/g, ''), 10) || 0;
            const currentBalance = parseInt($(tds[6]).text().trim().replace(/,/g, ''), 10) || 0;
            const change = parseInt($(tds[7]).text().trim().replace(/,/g, ''), 10) || 0;

            loanData.push({
                stockCode,
                initPrice,
                previousBalance,
                currentBalance,
                change
            });
        });

        return loanData;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function fetchMarginRate(stockCode) {
    try {
        const url = `https://www.istock.tw/stock/${stockCode}/margin-rate`;
        const response = await axios.get(url, {
            headers: istockHeaders,
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        let marginRate = null;
        let marginRateChange = null;
        const firstRow = $('.table-responsive table tr:nth-child(1)');
        const targetColumn = firstRow.find('td:nth-child(9)').text().trim();
        let targetText = targetColumn.split(' ');
        let number = targetText[0]
        let changeText = targetText[1]
        let match = changeText.match(/\d+\.\d+/);
        let change = match ? match[0] : null;

        marginRate = +number;
        marginRateChange = +change;
        if (!targetColumn) {
            console.log(`${stockCode} 未找到融資使用率數據`);
            return null;
        }


        return { marginRate, marginRateChange };
    } catch (error) {
        console.error(`獲取 ${stockCode} 融資使用率失敗:`, error.message);
        return null;
    }
}

const createLoanRankings = async (req, res) => {
    try {
        let today = new Date();
        let dayOfWeek = today.getDay(); 

        if (dayOfWeek === 6) {
            today.setDate(today.getDate() - 1); 
        } else if (dayOfWeek === 0) {
            today.setDate(today.getDate() - 2); 
        }

        const formattedToday = today.toISOString().split('T')[0];
        
        const existingRecords = await Loan.findOne({
            where: {
                createdAt: formattedToday
            }
        });
        
        if (existingRecords) {
            return res.status(200).json({ 
                message: `Data for ${formattedToday} already exists`, 
                success: true,
                isExisting: true
            });
        }
        const loanDataTWSE = await fetchLoanRankingData('TWSE');
        const loanDataOTC = await fetchLoanRankingData('OTC');
        let loanData = [...loanDataTWSE, ...loanDataOTC];

        if (!loanData.length) {
            return res.status(400).json({ message: 'No data fetch', success: false });
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
            console.log(`Error Stock codes: ${nonExistingStockCodes.join(', ')}`);
        }

        const filteredLoanData = loanData.filter(item => existingStockCodes.includes(item.stockCode));
        const enhancedLoanDataPromises = filteredLoanData.map(async (item) => {
            const { marginRate, marginRateChange } = await fetchMarginRate(item.stockCode);
            return {
                ...item,
                marginRate,
                marginRateChange
            };
        });
        const enhancedLoanData = await Promise.all(enhancedLoanDataPromises);
        await Loan.bulkCreate(enhancedLoanData);

        return res.status(200).json({
            message: 'Successful Created',
            success: true,
            count: enhancedLoanData.length,
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllLoans = async (req, res) => {
    try {
        const data = await Loan.findAll({
            attributes: { exclude: ['password'] },
        });
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    fetchLoanRankingData,
    createLoanRankings,
    getAllLoans
};