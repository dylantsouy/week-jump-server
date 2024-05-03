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

async function fetchData(codeArray, perd, date) {
    const yahooStockUrl = `https://tw.quote.finance.yahoo.net/quote/q?type=ta&perd=${perd}&mkt=10&sym=${codeArray.code}&v=1&callback=test123`;
    try {
        const response = await axios.get(yahooStockUrl, { headers: header });
        const text = response.data.replace('test123(', '');
        const full_text = JSON.parse(text.slice(0, -2));
        const tickData = full_text['ta'];
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
            const this_low = _this.o;
            const last_high = _last.h;
            if (this_low > last_high) {
                let success = {
                    stockCode: codeArray.code,
                    price: last_high,
                    date,
                };
                console.log('has jump', success);
                return success;
            }
            console.log('no jump', codeArray);
            return null;
        }
        console.log('tick less than 2', codeArray);
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
        for (const codeArray of stock_codes) {
            const result = await fetchData(codeArray, perd, date);
            if (result) {
                data.push(result);
            }
        }
        const createdJumps = [];
        for (const jumpData of data) {
            const { stockCode, price } = jumpData;
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
                    price,
                    closed: false,
                    jumpId: jump.id,
                    date,
                });
            }
            if (record) createdJumps.push({ type: perd, price, code: stockCode, date, closed: false });
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
        const jumps = await Jump.findAll({
            include: [Stock, JumpsRecord],
        });

        return res.status(200).json({ data: jumps, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateJumpRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, price, closed, date } = req.body;

        if (!type || !price || !closed || !date) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const body = {
            type,
            price,
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
        const deleted = await JumpsRecord.destroy({
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

module.exports = {
    createJumps,
    getAllJumps,
    updateJumpRecord,
    deleteJump,
    deleteJumpsRecord,
};
