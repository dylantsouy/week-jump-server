const { Jump, JumpsRecord, Stock } = require('../models');
const axios = require('axios');
const { stock_codes } = require('../saveData');
const { errorHandler } = require('../helpers/responseHelper');
const moment = require('moment');

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

async function fetchData(target, perd, date) {
    const yahooStockUrl = `https://tw.quote.finance.yahoo.net/quote/q?type=ta&perd=${perd}&mkt=10&sym=${target.code}&v=1&callback=test123`;
    try {
        const response = await axios.get(yahooStockUrl, { headers: header });
        const data = response.data;
        const jsonData = JSON.parse(data.substring(data.indexOf('(') + 1, data.lastIndexOf(')')));
        const tickData = jsonData.ta;
        
        if (tickData.length > 2) {
            let dateIndex = -1;
            const targetDateNum = parseInt(date);
            
            // 對 tickData 按日期排序（假設已按日期排好）
            const availableDates = tickData.map(item => parseInt(item.t)).sort((a, b) => a - b);
            
            // 記錄每個可用日期在原始 tickData 中的索引
            const dateToIndexMap = {};
            tickData.forEach((item, index) => {
                dateToIndexMap[parseInt(item.t)] = index;
            });
            
            
            // 週線和月線使用統一的查找方法，但有不同的日期處理邏輯
            if (perd === 'w') {
                // 計算可能的日期範圍：從每個交易日+3天，看是否與目標日期匹配
                for (const availableDate of availableDates) {
                    const adjDate = moment(availableDate.toString(), 'YYYYMMDD').add(3, 'days').format('YYYYMMDD');
                    
                    // 檢查調整後的日期是否符合目標日期
                    if (adjDate === date) {
                        dateIndex = dateToIndexMap[availableDate];
                        break;
                    }
                }
                
                // 如果沒有找到精確匹配，查找最接近的日期
                if (dateIndex === -1) {
                    // 將目標日期減去3天，尋找最接近的交易日
                    const targetMinusThree = moment(date, 'YYYYMMDD').subtract(3, 'days').format('YYYYMMDD');
                    const targetMinusThreeNum = parseInt(targetMinusThree);
                    
                    let closestDate = null;
                    for (const availableDate of availableDates) {
                        if (availableDate <= targetMinusThreeNum && (!closestDate || availableDate > closestDate)) {
                            closestDate = availableDate;
                        }
                    }
                    
                    if (closestDate) {
                        dateIndex = dateToIndexMap[closestDate];
                    }
                }
            } else {
                // 月線：找到最接近但不超過目標日期的交易日
                let closestDate = null;
                for (const availableDate of availableDates) {
                    if (availableDate <= targetDateNum && (!closestDate || availableDate > closestDate)) {
                        closestDate = availableDate;
                    }
                }
                
                if (closestDate) {
                    dateIndex = dateToIndexMap[closestDate];
                }
            }
            
            if (dateIndex === -1) {
                return null;
            }
            
            // 確保索引是有效的
            if (dateIndex + 1 >= tickData.length) {
                return null;
            }
            
            const _this = tickData[dateIndex + 1];
            const _last = tickData[dateIndex];
            
            if (!_this || !_last) {
                return null;
            }
            const last_value = _last.v;
            const this_open = _this.o;
            const this_low = _this.l;
            const last_high = _last.h;
            
            if (this_open > last_high && this_open > 15 && last_value > 100) {
                let success = {
                    stockCode: target.code,
                    lastHight: last_high,
                    thisOpen: this_open,
                    thisLow: this_low,
                    date,
                    lastValue: last_value,
                };
                return success;
            }
            return null;
        }
        return null;
    }  catch (error) {
        console.error('Error fetching data for', target.code, ':', error.message);
        return null;
    }
}

const createJumps = async (req, res) => {
    try {
        const { perd, date } = req.body;
        if (!perd || !date) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }
        const data = [];
        for (const target of stock_codes) {
            const result = await fetchData(target, perd, date);
            if (result) {
                data.push(result);
            }
        }
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
        return res.status(200).json({ message: 'Successful Created', newJumps: createdJumps, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};
const getJumpRecord = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "Stock code is required", success: false });
        }

        // Fix: Properly define the association query
        let jump = await Jump.findOne({
            include: [
                {
                    model: Stock,
                    where: { code: id },
                    required: true
                },
                {
                    model: JumpsRecord,
                    required: false
                }
            ]
        });

        if (!jump) {
            return res.status(200).json({ message: "Jump record not found", data: {}, success: true });
        }

        let newestRecord = null;
        let newestRecordClosed = null;
        let jumpCount_w = 0;
        let jumpCount_w_c = 0;
        let jumpCount_m = 0;
        let jumpCount_m_c = 0;

        jump.JumpsRecords.forEach(record => {
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
        let jumps = await Jump.findAll({
            include: [Stock, JumpsRecord],
        });

        let result = [];
        let stockJumpCount = {};
        // let industryCount = {};
        // let maxIndustry = {
        //     name: null,
        //     count: 0,
        // };

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

            // if (!industryCount[stockIndustry]) {
            //     industryCount[stockIndustry] = 0;
            // }
            // industryCount[stockIndustry] += filteredRecords.length;

            // if (industryCount[stockIndustry] > maxIndustry.count) {
            //     maxIndustry = {
            //         name: stockIndustry,
            //         count: industryCount[stockIndustry],
            //     };
            // }

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
            // maxIndustry,
        };

        return res.status(200).json({ data: final, success: true });
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

        if (!type || !lastPrice || !closed || !date || !lastValue || !jumpPrice) {
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
    getJumpRecord
};
