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

const updateObserveRecordReason = async (req, res) => {
    try {
        const { original, changeTo } = req.body;

        // 檢查請求參數
        if (!original || !changeTo) {
            return res.status(400).json({ message: 'Missing required fields', success: false });
        }

        // 查找符合 original 的記錄
        const matchingRecords = await ObservesRecord.findAll({
            where: { reason: original },
        });

        if (matchingRecords.length === 0) {
            return res.status(404).json({ message: 'No matching records found', success: false });
        }

        // 更新 reason 欄位
        const [updatedCount] = await ObservesRecord.update(
            { reason: changeTo },
            { where: { reason: original } }
        );

        return res.status(200).json({
            message: 'Records updated successfully',
            updatedCount,
            success: true,
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getObserveById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Observe ID is required", success: false });
        }

        const observe = await Observe.findOne({
            where: { stockCode: id },
            include: [
                {
                    model: Stock,
                    attributes: ['code', 'name', 'industry', 'price', 'updatedAt'],
                },
                {
                    model: ObservesRecord,
                    attributes: ['type', 'price', 'date', 'reason'],
                },
            ],
        });

        if (!observe) {
            return res.status(200).json({ message: "Observe record not found", data: {}, success: false });
        }

        let latestRecord = null;
        observe.ObservesRecords.forEach((record) => {
            if (!latestRecord || new Date(record.date) > new Date(latestRecord.date)) {
                latestRecord = record;
            }
        });

        const result = {
            id: observe.id,
            code: observe.Stock.code,
            name: observe.Stock.name,
            industry: observe.Stock.industry,
            price: +observe.Stock.price,
            stockUpdatedAt: observe.Stock.updatedAt,
            latestRecord,
            initPrice: +observe.initPrice,
            createdAt: observe.createdAt,
            updatedAt: observe.updatedAt,
            records: observe.ObservesRecords,
        };

        return res.status(200).json({ data: result, success: true });
    } catch (error) {
        console.error("Error in getObserveById:", error);
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
}; const getAllObserves = async (req, res) => {
    try {
        const { type, date } = req.query;

        const data = await Observe.findAll({
            include: [
                {
                    model: Stock,
                    attributes: ['code', 'name', 'industry', 'price', 'updatedAt'],
                },
                {
                    model: ObservesRecord,
                    attributes: ['type', 'price', 'date', 'reason'],
                },
            ],
            order: [['createdAt', 'ASC']],
        });

        // 過濾及整理數據
        const adjustedData = data
            .map((item) => {
                let latestRecord = null;

                // 初始化所有可能的 type 為 0
                const typeCount = {
                    1: 0,
                    2: 0,
                    3: 0,
                };

                // 計算每種 type 的出現次數
                item.ObservesRecords.forEach((record) => {
                    const recordType = record.type;
                    typeCount[recordType] = (typeCount[recordType] || 0) + 1;

                    // 找到最新的紀錄
                    if (!latestRecord || new Date(record.date) > new Date(latestRecord.date)) {

                        latestRecord = {
                            type: record?.type,
                            price: +record?.price,
                            date: record?.date,
                            reason: record?.reason,
                        };
                    }
                });

                return {
                    id: item.id,
                    code: item.Stock.code,
                    name: item.Stock.name,
                    industry: item.Stock.industry,
                    price: +item.Stock.price,
                    stockUpdatedAt: item.Stock.updatedAt,
                    latestRecord,
                    initPrice: +item.initPrice,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    typeCount,
                };
            })
            .filter((item) => {
                // 先過濾 type 條件
                const typeCondition = !type || item.latestRecord?.type === parseInt(type);

                // 再過濾日期條件
                if (!date || !item.latestRecord) return typeCondition;

                // 將 latestRecord.date 轉換為 YYYY-MM-DD 格式以便比較
                const recordDate = new Date(item.latestRecord.date);
                const recordDateStr = recordDate.toISOString().split('T')[0];

                return typeCondition && recordDateStr === date;
            });

        return res.status(200).json({ data: adjustedData, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
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

        return res.status(200).json({ data, success: true });
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

        const [updated] = await ObservesRecord.update(body, {
            where: { id },
        });
        const data = await ObservesRecord.findOne({ where: { id } });
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
        if (deleteAll) {
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
    getObserveById,updateObserveRecordReason
};
