const { Observe, Stock, ObservesRecord } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');

const createObserveRecord = async (req, res) => {
    try {
        const { date, type, price, stockCode, reason } = req.body;
        if (!date || !type || !price || !stockCode) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const existingStock = await Stock.findOne({ where: { code: stockCode } });
        if (!existingStock) {
            return res.status(400).json({ message: 'No Stock existed', success: false });
        }

        if (parseInt(type) !== 1 && parseInt(type) !== 2 && parseInt(type) !== 3) {
            return res.status(400).json({ message: 'Type should be 1 or 2 or 3', success: false });
        }

        let existingObserve = await Observe.findOne({ where: { stockCode } });

        if (!existingObserve) {
            const body = {
                stockCode,
                initPrice: price,
                createdAt: date,
            };

            existingObserve = await Observe.create(body);
        }

        const body = {
            date,
            type: parseInt(type),
            price,
            observeId: existingObserve.id,
            reason,
        };

        const data = await ObservesRecord.create(body);
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllObserves = async (req, res) => {
    try {
        const { type } = req.query;
        const data = await Observe.findAll({
            include: [
                {
                    model: Stock,
                    attributes: ['code', 'name', 'industry', 'price', 'updatedAt'],
                },
                {
                    model: ObservesRecord,
                    attributes: ['type'],
                },
            ],
            order: [['createdAt', 'ASC']],
        });

        let adjustedData = data.map((item) => {
            const observe1Count = item.ObservesRecords.filter((record) => record.type === 1).length;
            const observe2Count = item.ObservesRecords.filter((record) => record.type === 2).length;
            const observe3Count = item.ObservesRecords.filter((record) => record.type === 3).length;

            return {
                id: item.id,
                code: item.Stock.code,
                name: item.Stock.name,
                industry: item.Stock.industry,
                price: item.Stock.price,
                stockUpdatedAt: item.Stock.updatedAt,
                observe1Count,
                observe2Count,
                observe3Count,
                initPrice: item.initPrice,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            };
        });
        if (type) {
            adjustedData = adjustedData.filter((item) => {
                if (parseInt(type) === 1) {
                    return item.observe1Count > 0;
                } else if (parseInt(type) === 2) {
                    return item.observe2Count > 0;
                } else if (parseInt(type) === 3) {
                    return item.observe3Count > 0;
                } else {
                    return true;
                }
            });
        }
        return res.status(200).json({ data: adjustedData, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const getObservesRecords = async (req, res) => {
    try {
        const { observeId } = req.params;

        if (!observeId) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const data = await ObservesRecord.findAll({
            where: { observeId },
            order: [['date', 'ASC']],
        });

        const observe1 = data.filter((record) => record.type === 1);
        const observe2 = data.filter((record) => record.type === 2);

        return res.status(200).json({ data: { observe1, observe2 }, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateObserve = async (req, res) => {
    try {
        const { id } = req.params;
        const { initPrice, createdAt } = req.body;

        if (!id || !initPrice || !createdAt) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const body = {
            initPrice,
            createdAt,
        };

        const [updated] = await Observe.update(body, {
            where: { id },
        });
        const data = await Observe.findOne({ where: { id } });
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

const updateObservesRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, type, price, reason } = req.body;

        if (!id || !date || !type || !price) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const body = {
            date,
            type,
            price,
            reason,
        };

        const [updated] = await Observe.update(body, {
            where: { id },
        });
        const data = await Observe.findOne({ where: { id } });
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

const deleteObserve = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Observe.destroy({
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

const deleteObservesRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { deleteAll, observeId } = req.body;
        const deleted = await ObservesRecord.destroy({
            where: { id },
        });
        if (deleteAll && type !== 3) {
            await Observe.destroy({
                where: { id: observeId },
            });
        }
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
    getAllObserves,
    updateObserve,
    deleteObserve,
    createObserveRecord,
    getObservesRecords,
    updateObservesRecord,
    deleteObservesRecord,
};
