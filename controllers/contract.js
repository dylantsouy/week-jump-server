const axios = require('axios');
const { stock_codes } = require('../saveData');
const { errorHandler } = require('../helpers/responseHelper');
const { ContractsRecord, Stock } = require('../models');
const cheerio = require('cheerio');
const { Op } = require('sequelize');

const HEADERS = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    Cookie: '_gid=GA1.2.1034226572.1684399994; __gads=ID=3741bf534fc8c51b-2295772d16e10023:T=1684399995:RT=1684399995:S=ALNI_MaSU35XhxiLV5Uce_2fX4_TUsqX6A; __gpi=UID=00000c07a3939141:T=1684399995:RT=1684399995:S=ALNI_MaoXdqNkbQ0ghZ4U67UX2dn2BtdDg; _gat_gtag_UA_23459331_1=1; _ga=GA1.1.84133539.1684399994; _ga_SLLJ8HE0W3=GS1.1.1684399994.1.1.1684400085.37.0.0',
    'Sec-Ch-Ua': '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
};

const RANK_OPTIONS = new Set(['yoy', 'qoq', 'percentage', 'all']);

const parseQuarterData = ($, quarter) => {
    const headerSection = $('div.tab-pane section.panel-default header.panel-heading');
    const rows = $('table.ecostyle1 tbody tr');

    if (headerSection.length === 0 || rows.length === 0) return null;

    for (let i = 0; i < rows.length; i++) {
        const cells = rows.eq(i).find('td');
        if (cells.length < 4) continue;

        const date = cells.eq(0).text().replace(/\s?\(\d+\)/, '').trim();
        if (date !== quarter) continue;

        const headerText = headerSection.eq(0).text();
        const percentageIndex = headerText.indexOf(':');
        if (percentageIndex === -1) continue;

        return {
            contractValue: cells.eq(1).text() || '0',
            qoq: cells.eq(2).text() || '0',
            yoy: cells.eq(3).text() || '0',
            percentage: headerText.substring(percentageIndex + 2, headerText.length - 1),
        };
    }
    return null;
};

const fetchData = async (target, quarter) => {
    const contractUrl = `https://www.istock.tw/stock/${target.code}/contract-liability`;
    
    try {
        const response = await axios.get(contractUrl, { headers: HEADERS });
        const $ = cheerio.load(response.data);
        const quarterData = parseQuarterData($, quarter);
        
        return quarterData ? { stockCode: target.code, ...quarterData } : null;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
};

const createContracts = async (req, res) => {
    try {
        const { quarter } = req.body;
        if (!quarter) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const fetchPromises = stock_codes.map(target => fetchData(target, quarter));
        const results = await Promise.all(fetchPromises);
        const validData = results.filter(Boolean);

        const createdContracts = [];
        
        for (const contractData of validData) {
            const { stockCode, percentage, contractValue, qoq, yoy } = contractData;
            
            const existingRecord = await ContractsRecord.findOne({
                where: { stockCode, quarter },
            });

            if (!existingRecord) {
                const record = await ContractsRecord.create({
                    percentage,
                    contractValue,
                    qoq,
                    yoy,
                    quarter,
                    stockCode,
                });
                if (record) createdContracts.push({ code: stockCode });
            }
        }

        if (createdContracts.length === 0) {
            return res.status(400).json({ message: 'No new contract created', success: false });
        }

        return res.status(200).json({ 
            message: 'Successful Created', 
            newContracts: createdContracts, 
            success: true 
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getContract = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const result = await Stock.findOne({
            where: { code },
            include: [{
                model: ContractsRecord,
                as: 'ContractsRecords',
                required: false,
            }],
        });

        if (!result) {
            return res.status(400).json({
                message: 'Code does not exists',
                success: false,
            });
        }

        return res.status(200).json({ data: result, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const bulkDeleteContract = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                message: 'IDs format error',
                success: false
            });
        }

        const deletedCount = await ContractsRecord.destroy({
            where: { id: ids }
        });

        if (deletedCount === 0) {
            return res.status(400).json({
                message: 'ID does not exists',
                success: false
            });
        }

        return res.status(200).json({
            message: 'Successful deleted',
            success: true,
            deletedCount
        });
    } catch (error) {
        return res.status(500).json({
            message: errorHandler(error),
            success: false
        });
    }
};

const getAllContracts = async (req, res) => {
    try {
        let { quarter, rank, range } = req.query;

        if (rank && !RANK_OPTIONS.has(rank)) {
            return res.status(400).json({ message: 'please fill correct rank', success: false });
        }

        if (rank === 'all') rank = null;
        if (rank && !range) range = 50;

        const rangeValue = parseFloat(range);
        if (rank && isNaN(rangeValue)) {
            return res.status(400).json({ message: 'please fill correct range', success: false });
        }

        const whereCondition = quarter ? { '$ContractsRecords.quarter$': quarter } : {};
        const includeWhere = (rank && range) ? { [rank]: { [Op.gt]: rangeValue } } : {};

        let stocks = await Stock.findAll({
            where: whereCondition,
            include: [{
                model: ContractsRecord,
                as: 'ContractsRecords',
                required: false,
                where: includeWhere,
                attributes: ['quarter', 'yoy', 'qoq', 'percentage', 'contractValue', 'id'],
            }],
        });

        if (quarter) {
            stocks = stocks.map(stock => {
                const stockData = stock.get({ plain: true });
                stockData.ContractsRecords = stockData.ContractsRecords?.[0] || null;
                return stockData;
            });
        }

        return res.status(200).json({ data: stocks, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    createContracts,
    getAllContracts,
    getContract,
    bulkDeleteContract
};