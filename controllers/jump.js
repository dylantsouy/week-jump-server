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
            let dateIndex;
            if (perd === 'd') {
                dateIndex = tickData.findIndex((item) => String(item.t) === date);
            } else if (perd === 'w') {
                dateIndex = tickData.findIndex((item) => {
                    const target = moment(item.t, 'YYYYMMDD');
                    const newDate = target.add(3, 'days').format('YYYYMMDD');
                    return newDate === date;
                });
            } else {
                dateIndex = tickData.findIndex((item) => {
                    const find = moment(date).subtract(1, 'days');
                    if (find.weekday() >= 1 && find.weekday() <= 5) {
                        let newDate = find.format('YYYYMMDD');
                        return newDate === String(item.t);
                    } else {
                        let newDate;
                        while (find.weekday() === 0 || find.weekday() === 6) {
                            newDate = find.subtract(1, 'days').format('YYYYMMDD');
                        }
                        return newDate === String(item.t);
                    }
                });
            }
            if (dateIndex === -1) {
                console.log('date error', date);
                return null;
            }
            let _this;
            let _last;
            if (perd === 'd') {
                _this = tickData[dateIndex];
                _last = tickData[dateIndex - 1];
            } else {
                _this = tickData[dateIndex + 1];
                _last = tickData[dateIndex];
            }
            if (!_this || !_last) {
                console.log('not yet open', target);
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
                console.log('has jump', success);
                return success;
            }
            console.log('no jump', target);
            return null;
        }
        console.log('tick less than 2', target);
        return null;
    } catch (error) {
        console.error('Error fetching data:', error);
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

const getAllJumps = async (req, res) => {
    try {
        const { type, date, closed } = req.query;
        let jumps = await Jump.findAll({
            include: [Stock, JumpsRecord],
        });

        let result = [];
        jumps.forEach(async (jump) => {
            let newestRecordClosed = null;
            let newestRecord = null;
            let newestDateClosed = null;
            let jumpCount_d = 0;
            let jumpCount_d_c = 0;
            let jumpCount_w = 0;
            let jumpCount_w_c = 0;
            let jumpCount_m = 0;
            let jumpCount_m_c = 0;
            const filteredRecords = jump.JumpsRecords.filter((record) => {
                if (record.type === 'd') {
                    if (record.closed === true) {
                        jumpCount_d_c++;
                    }
                    jumpCount_d++;
                } else if (record.type === 'w') {
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
                if (closed === 'false' && String(record.closed) !== closed) return false;

                if (date && record.date !== date) return false;

                if (type && record.type !== type) return false;

                // 找出最新的 JumpsRecord
                if (
                    (!newestRecord || moment(record.date, 'YYYYMMDD').isAfter(moment(newestRecord, 'YYYYMMDD'))) &&
                    !record.closed
                ) {
                    newestRecord = record;
                }

                if (
                    !newestRecordClosed ||
                    moment(record.date, 'YYYYMMDD').isAfter(moment(newestRecordClosed, 'YYYYMMDD'))
                ) {
                    newestRecordClosed = record;
                    newestDateClosed = record.date;
                }
                return true;
            });

            if (!newestRecord) {
                newestRecord = newestRecordClosed;
            }

            let details = {
                jumpCount_d,
                jumpCount_w,
                jumpCount_m,
                jumpCount_d_c,
                jumpCount_w_c,
                jumpCount_m_c,
            };
            if (filteredRecords.length) {
                result.push({
                    ...jump.toJSON(),
                    details,
                    newest: newestRecord,
                });
            }
        });

        return res.status(200).json({ data: result, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateIfClosed = async () => {
    try {
        const jumps = await Jump.findAll({
            include: [Stock, JumpsRecord],
        });

        for (const jump of jumps) {
            for (const record of jump.JumpsRecords) {
                if (record.lastPrice >= jump.Stock.price && !record.closed) {
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

module.exports = {
    createJumps,
    getAllJumps,
    updateJumpRecord,
    deleteJump,
    deleteJumpsRecord,
    updateIfClosed,
};
