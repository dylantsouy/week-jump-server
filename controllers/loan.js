const { Stock, Loan } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const axios = require('axios');
const cheerio = require('cheerio');
const { Op } = require('sequelize');
const moment = require('moment');

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
async function fetchLoanRankingData(type, date) {
    try {
        let url = type === 'TWSE' ? 'https://fubon-ebrokerdj.fbs.com.tw/Z/ZG/ZG_E.djhtm' : 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_E_1_1.djhtm'
        const response = await axios.get(url, {
            headers: headers
        });

        const $ = cheerio.load(response.data);

        const loanData = [];
        let dateText = $('.t11').text();
        let pageDate = dateText.slice(5, 10);
        let today = new Date(date);
        let dayOfWeek = today.getDay();

        if (dayOfWeek === 6) {
            today.setDate(today.getDate() - 1);
        } else if (dayOfWeek === 0) {
            today.setDate(today.getDate() - 2);
        }
        let todayMonth = String(today.getMonth() + 1).padStart(2, '0');
        let todayDay = String(today.getDate()).padStart(2, '0');
        let todayFormatted = `${todayMonth}/${todayDay}`;
        let todayYear = today.getFullYear();
        let recordDate = `${todayYear}/${todayMonth}/${todayDay}`;
        if (pageDate !== todayFormatted) {
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
                recordDate,
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
        let { date } = req.body;
        let today = new Date(date);

        let dayOfWeek = today.getDay();

        if (dayOfWeek === 6) {
            today.setDate(today.getDate() - 1);
        } else if (dayOfWeek === 0) {
            today.setDate(today.getDate() - 2);
        }
        const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const existingRecords = await Loan.findOne({
            where: {
                recordDate: localToday
            }
        });
        if (existingRecords) {
            return res.status(200).json({
                message: `Data for ${localToday} already exists`,
                success: true,
                isExisting: true
            });
        }
        const loanDataTWSE = await fetchLoanRankingData('TWSE', localToday);
        const loanDataOTC = await fetchLoanRankingData('OTC', localToday);
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
                recordDate: localToday,
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

const getLoanRecords = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }
        const stockCode = String(code);

        const data = await Loan.findAll({
            where: { stockCode: stockCode },
            include: [{
                model: Stock,
                attributes: ['code', 'name', 'industry', 'price', 'updatedAt'],
                required: true
            }],
            order: [['stockCode', 'ASC'], ['recordDate', 'DESC']]
        });

        if (data.length === 0) {
            return res.status(200).json({ message: 'No loan records found for this stock code', success: true });
        }

        const loanMap = new Map();
        let result = {};

        for (const loan of data) {
            const loanData = loan.get({ plain: true });
            const { stockCode, Stock, ...recordData } = loanData;

            if (!loanMap.has(stockCode)) {
                const stockEntry = {
                    stockCode,
                    stockName: Stock.name,
                    industry: Stock.industry,
                    price: Stock.price,
                    updatedAt: Stock.updatedAt,
                    latestRecordDate: loanData.recordDate,
                    latestRecord: recordData,
                    records: [recordData]  // 首次資料為唯一記錄
                };

                loanMap.set(stockCode, stockEntry);
                result = stockEntry;
            } else {
                loanMap.get(stockCode).records.push(recordData);
            }
        }

        return res.status(200).json({ data: result, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};


const getAllLoans = async (req, res) => {
    try {
        const { date } = req.query;

        let whereClause = {};
        if (date) {
            const inputDate = new Date(date);
            const localDate = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
            whereClause.recordDate = localDate;
        }

        const loans = await Loan.findAll({
            where: whereClause,
            include: [{
                model: Stock,
                attributes: ['code', 'name', 'industry', 'price', 'updatedAt'],
                required: false
            }],
            order: [['stockCode', 'ASC'], ['recordDate', 'DESC']]
        });

        const stockMap = new Map();
        const result = [];

        for (const loan of loans) {
            const loanData = loan.get({ plain: true });
            const { stockCode, Stock } = loanData;

            if (!stockMap.has(stockCode)) {
                const { Stock, ...latestRecord } = loanData;

                const stockEntry = {
                    stockCode,
                    stockName: Stock?.name || '',
                    industry: Stock?.industry || '',
                    price: Stock?.price || '',
                    updatedAt: Stock?.updatedAt || '',
                    latestRecordDate: loanData.recordDate,
                    latestRecord,
                    records: [latestRecord]
                };

                result.push(stockEntry);
                stockMap.set(stockCode, stockEntry);
            } else {
                const { Stock, ...recordWithoutStock } = loanData;
                stockMap.get(stockCode).records.push(recordWithoutStock);
            }
        }

        return res.status(200).json({ data: result, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const bulkDeleteLoan = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send({
                message: 'IDs format error',
                success: false
            });
        }

        const deletedCount = await Loan.destroy({
            where: { id: ids }
        });

        if (deletedCount > 0) {
            return res.status(200).send({
                message: `Successful deleted`,
                success: true,
                deletedCount
            });
        } else {
            return res.status(400).send({
                message: 'ID does not exists',
                success: false
            });
        }
    } catch (error) {
        return res.status(500).send({
            message: errorHandler(error),
            success: false
        });
    }
};

module.exports = {
    fetchLoanRankingData,
    createLoanRankings,
    getAllLoans,
    bulkDeleteLoan,
    getLoanRecords
};