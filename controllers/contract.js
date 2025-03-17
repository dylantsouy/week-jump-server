const axios = require('axios');
const { stock_codes } = require('../saveData');
const { errorHandler } = require('../helpers/responseHelper');
const { ContractsRecord, Stock } = require('../models');
const cheerio = require('cheerio');
const { Op } = require('sequelize');

const header = {
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
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
};
async function fetchData(target, quarter) {
    const contractUrl = `https://www.istock.tw/stock/${target.code}/contract-liability`;
    try {
        const response = await axios.get(contractUrl, { headers: header });
        const $ = cheerio.load(response.data);
        const rs = $('div.tab-pane section.panel-default header.panel-heading');
        const rs2 = $('table.ecostyle1 tbody tr');

        // Loop through all rows to find the matching quarter
        if (rs.length > 0 && rs2.length > 0) {
            // Try to find the exact quarter in the table
            for (let i = 0; i < rs2.length; i++) {
                const row = rs2.eq(i);
                const td = row.find('td');
                
                if (td.length >= 4) {
                    let date = td.eq(0).text();
                    let cleaned_date = date.replace(/\s?\(\d+\)/, '').trim();
                    
                    // If this row has the quarter we're looking for
                    if (cleaned_date === quarter) {
                        let contractValue = td.eq(1).text() || '0';
                        let qoq = td.eq(2).text() || '0';
                        let yoy = td.eq(3).text() || '0';
                        let stg = rs.eq(0).text();
                        let index = stg.indexOf(':');
                        
                        if (index !== -1) {
                            let percentage = stg.substring(index + 2, stg.length - 1);
                            let success = {
                                stockCode: target.code,
                                percentage,
                                contractValue,
                                qoq,
                                yoy,
                            };
                            return success;
                        }
                    }
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}
const createContracts = async (req, res) => {
    try {
        const { quarter } = req.body;
        if (!quarter) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }
        const data = [];
        for (const target of stock_codes) {
            const result = await fetchData(target, quarter);
            if (result) {
                data.push(result);
            }
        }
        const createdContracts = [];
        for (const contractData of data) {
            const { stockCode, percentage, contractValue, qoq, yoy } = contractData;
            const existingRecord = await ContractsRecord.findOne({
                where: { stockCode, quarter },
            });
            let record = null;
            if (!existingRecord) {
                record = await ContractsRecord.create({
                    percentage,
                    contractValue,
                    qoq,
                    yoy,
                    quarter,
                    stockCode,
                });
            }
            if (record) createdContracts.push({ code: stockCode });
        }
        if (createdContracts.length === 0) {
            return res.status(400).json({ message: 'No new contract created', success: false });
        }
        return res.status(200).json({ message: 'Successful Created', newContracts: createdContracts, success: true });
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

        let result = await Stock.findOne({
            where: { code },
            include: [
                {
                    model: ContractsRecord,
                    as: 'ContractsRecords',
                    required: false,
                },
            ],
        });
        if (result) {
            return res.status(200).json({ data: result, success: true });
        } else {
            return res.status(400).send({
                message: 'Code does not exists',
                success: false,
            });
        }
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const bulkDeleteContract = async (req, res) => {
    try {
      const { ids } = req.body; 
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).send({
          message: 'IDs format error',
          success: false
        });
      }
      
      const deletedCount = await ContractsRecord.destroy({
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
const getAllContracts = async (req, res) => {
    try {
        let { quarter, rank, range } = req.query;

        if (rank && rank !== 'yoy' && rank !== 'qoq' && rank !== 'percentage' && rank !== 'all') {
            return res.status(400).json({ message: 'please fill correct rank', success: false });
        }

        if (rank === 'all') {
            rank = null;
        }

        if (rank && !range) {
            range = 50;
        }

        const rangeValue = parseFloat(range);

        if (rank && isNaN(rangeValue)) {
            return res.status(400).json({ message: 'please fill correct range', success: false });
        }

        let whereCondition = {};
        if (quarter) {
            whereCondition['$ContractsRecords.quarter$'] = quarter;
        }

        let stocks = await Stock.findAll({
            where: whereCondition,
            include: [
                {
                    model: ContractsRecord,
                    as: 'ContractsRecords',
                    required: false,
                    where:
                        rank && range
                            ? {
                                  [rank]: {
                                      [Op.gt]: rangeValue,
                                  },
                              }
                            : {},
                    attributes: ['quarter', 'yoy', 'qoq', 'percentage', 'contractValue','id'],
                },
            ],
        });

        if (quarter) {
            stocks = stocks.map((stock) => {
                let stockData = stock.get({ plain: true });
                stockData.ContractsRecords = stockData.ContractsRecords ? stockData.ContractsRecords[0] : null;
                return stockData;
            });
        }

        return res.status(200).json({ data: stocks, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    createContracts,
    getAllContracts,
    getContract,
    bulkDeleteContract
};
