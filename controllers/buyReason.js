const { BuyReason } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// 取得所有購買原因
const getAllBuyReasons = async (req, res) => {
    try {
        const data = await BuyReason.findAll({
            order: [['name', 'ASC']]
        });

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 取得單一購買原因
const getBuyReasonById = async (req, res) => {
    try {
        const data = await BuyReason.findByPk(req.params.id);

        if (!data) {
            return res.status(404).json({ message: 'Buy reason not found', success: false });
        }

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 建立購買原因
const createBuyReason = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Name is required', success: false });
        }

        // 檢查名稱是否已存在
        const existingBuyReason = await BuyReason.findOne({
            where: { name }
        });

        if (existingBuyReason) {
            return res.status(400).json({ message: 'Buy reason with this name already exists', success: false });
        }

        const data = await BuyReason.create({
            id: uuidv4(),
            name,
            description
        });

        return res.status(201).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 更新購買原因
const updateBuyReason = async (req, res) => {
    try {
        const { name, description } = req.body;

        const buyReason = await BuyReason.findByPk(req.params.id);
        if (!buyReason) {
            return res.status(404).json({ message: 'Buy reason not found', success: false });
        }

        // 如果更改名稱，檢查是否與其他項目重複
        if (name && name !== buyReason.name) {
            const existingBuyReason = await BuyReason.findOne({
                where: { 
                    name,
                    id: { [Op.ne]: req.params.id }
                }
            });

            if (existingBuyReason) {
                return res.status(400).json({ message: 'Buy reason with this name already exists', success: false });
            }
        }

        await buyReason.update({
            name,
            description
        });

        return res.status(200).json({ data: buyReason, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 軟刪除購買原因
const deleteBuyReason = async (req, res) => {
    try {
        const buyReason = await BuyReason.findByPk(req.params.id);
        if (!buyReason) {
            return res.status(404).json({ message: 'Buy reason not found', success: false });
        }

        // 軟刪除
        await buyReason.destroy();

        return res.status(200).json({ message: 'Buy reason deleted successfully', success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 恢復軟刪除的購買原因
const restoreBuyReason = async (req, res) => {
    try {
        const buyReason = await BuyReason.findByPk(req.params.id, {
            paranoid: false // 包含軟刪除的記錄
        });

        if (!buyReason) {
            return res.status(404).json({ message: 'Buy reason not found', success: false });
        }

        if (!buyReason.deletedAt) {
            return res.status(400).json({ message: 'Buy reason is not deleted', success: false });
        }

        await buyReason.restore();

        return res.status(200).json({ data: buyReason, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 取得已刪除的購買原因
const getDeletedBuyReasons = async (req, res) => {
    try {
        const data = await BuyReason.findAll({
            paranoid: false,
            where: {
                deletedAt: { [Op.ne]: null }
            },
            order: [['deletedAt', 'DESC']]
        });

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 永久刪除購買原因
const forceDeleteBuyReason = async (req, res) => {
    try {
        const buyReason = await BuyReason.findByPk(req.params.id, {
            paranoid: false
        });

        if (!buyReason) {
            return res.status(404).json({ message: 'Buy reason not found', success: false });
        }

        // 檢查是否有交易記錄正在使用此購買原因
        // 這裡需要根據你的實際關聯調整
        // const usageCount = await TradingRecord.count({
        //     where: { buyReasonId: req.params.id },
        //     paranoid: false
        // });

        // if (usageCount > 0) {
        //     return res.status(400).json({ 
        //         message: `Cannot permanently delete buy reason. It is being used by ${usageCount} trading record(s).`,
        //         success: false,
        //         data: { usageCount }
        //     });
        // }

        await buyReason.destroy({ force: true });

        return res.status(200).json({ message: 'Buy reason permanently deleted', success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    getAllBuyReasons,
    getBuyReasonById,
    createBuyReason,
    updateBuyReason,
    deleteBuyReason,
    restoreBuyReason,
    getDeletedBuyReasons,
    forceDeleteBuyReason
};