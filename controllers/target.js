const { Target, Stock } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');

const createTarget = async (req, res) => {
    try {
        const { stockCode } = req.body;

        const existingTarget = await Target.findOne({ where: { stockCode } });
        if (existingTarget) {
            return res.status(400).json({ message: 'Target with the same stockCode already exists', success: false });
        }

        const stock = await Stock.findOne({ where: { code: stockCode } });
        if (!stock) {
            return res.status(400).json({ message: 'Stock not found', success: false });
        }

        const body = {
            stockCode: req.body.stockCode,
            rate: req.body.rate,
            initPrice: req.body.initPrice,
            eps: req.body.eps,
            averagePE: req.body.averagePE,
            sort: req.body.sort,
            CAGR: req.body.CAGR,
            yield: req.body.yield,
            createdAt: req.body.createdAt,
        };

        const data = await Target.create(body);
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllTargets = async (req, res) => {
    try {
        const data = await Target.findAll({
            include: Stock,
            raw: true,
            order: [['sort', 'ASC']]
        });

        const adjustedData = data.map((item) => {
            return {
                id: item.id,
                code: item['Stock.code'],
                name: item['Stock.name'],
                industry: item['Stock.industry'],
                price: item['Stock.price'],
                stockUpdatedAt: item['Stock.updatedAt'],
                rate: item.rate,
                initPrice: item.initPrice,
                sort: item.sort,
                eps: item.eps,
                averagePE: item.averagePE,
                CAGR: item.CAGR,
                yield: item.yield,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            };
        });

        return res.status(200).json({ data: adjustedData, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateTarget = async (req, res) => {
    try {
        const { id } = req.params;

        const body = {
            rate: req.body.rate,
            initPrice: req.body.initPrice,
            eps: req.body.eps,
            averagePE: req.body.averagePE,
            sort: req.body.sort,
            CAGR: req.body.CAGR,
            yield: req.body.yield,
            createdAt: req.body.createdAt,
        };

        const [updated] = await Target.update(body, {
            where: { id },
        });
        const data = await Target.findOne({ where: { id } });
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

const deleteTarget = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Target.destroy({
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
    createTarget,
    getAllTargets,
    updateTarget,
    deleteTarget,
};
