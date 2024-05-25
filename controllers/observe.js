const { Observe, Stock, ObservesRecord } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');

const createObserve = async (req, res) => {
    try {
        const { stockCode, initPrice, createdAt } = req.body;

        if (!stockCode || !initPrice || !createdAt) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const existingObserve = await Observe.findOne({ where: { stockCode } });
        if (existingObserve) {
            return res.status(400).json({ message: 'Observe with the same stockCode already exists', success: false });
        }

        const stock = await Stock.findOne({ where: { code: stockCode } });
        if (!stock) {
            return res.status(400).json({ message: 'Stock not found', success: false });
        }

        const body = {
            stockCode,
            initPrice,
            createdAt,
        };

        const data = await Observe.create(body);
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const createObserveRecord = async (req, res) => {
    try {
        const { date, observeId, type, price } = req.body;

        if (!date || !observeId || !type || !price) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        if (type !== 1 || type !== 2) {
            return res.status(400).json({ message: 'Type should be 1 or 2', success: false });
        }

        const existingObserve = await Observe.findOne({ where: { id: observeId } });

        if (!existingObserve) {
            return res.status(400).json({ message: 'Observe not found', success: false });
        }

        const body = {
            date,
            type,
            price,
            observeId,
        };

        const data = await ObservesRecord.create(body);
        return res.status(200).json({ data, success: true });

    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllObserves = async (req, res) => {
    try {
        const data = await Observe.findAll({
            include: [
                {
                    model: Stock,
                    attributes: ['code', 'name', 'industry', 'price', 'updatedAt'],
                },
                {
                    model: ObservesRecord,
                    attributes: ['type'],
                }
            ],
            order: [['createdAt', 'ASC']],
        });

        const adjustedData = data.map((item) => {
            const observe1Count = item.ObservesRecords.filter(record => record.type === 1).length;
            const observe2Count = item.ObservesRecords.filter(record => record.type === 2).length;

            return {
                id: item.id,
                code: item.Stock.code,
                name: item.Stock.name,
                industry: item.Stock.industry,
                price: item.Stock.price,
                stockUpdatedAt: item.Stock.updatedAt,
                observe1Count: observe1Count,
                observe2Count: observe2Count,
                initPrice: item.initPrice,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            };
        });
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

        return res.status(200).json({ data: data, success: true });
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
        const { date, type, price } = req.body;

        if (!id || !date || !type || !price) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const body = {
            date, type, price
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
        const deleted = await ObservesRecord.destroy({
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
    createObserve,
    getAllObserves,
    updateObserve,
    deleteObserve,
    createObserveRecord,
    getObservesRecords,
    updateObservesRecord,
    deleteObservesRecord
};
