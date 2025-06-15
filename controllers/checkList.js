const { CheckList, TradingRecordCheckList, TradingRecord, Stock } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');

// 取得所有檢查清單
const getAllCheckLists = async (req, res) => {
    try {
        const { isActive } = req.query;
        const where = {};
        
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        const data = await CheckList.findAll({
            where,
            order: [['sortOrder', 'ASC'], ['name', 'ASC']]
        });

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 取得啟用的檢查清單（給新增記錄時使用）
const getActiveCheckLists = async (req, res) => {
    try {
        const data = await CheckList.findAll({
            where: { isActive: true },
            order: [['sortOrder', 'ASC'], ['name', 'ASC']]
        });

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 取得單一檢查清單
const getCheckListById = async (req, res) => {
    try {
        const data = await CheckList.findByPk(req.params.id);

        if (!data) {
            return res.status(404).json({ message: 'Checklist not found', success: false });
        }

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 建立檢查清單
const createCheckList = async (req, res) => {
    try {
        const { name, description, isActive = true } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Name is required', success: false });
        }

        // 檢查名稱是否已存在
        const existingCheckList = await CheckList.findOne({
            where: { name }
        });

        if (existingCheckList) {
            return res.status(400).json({ message: 'Checklist with this name already exists', success: false });
        }

        // 自動取得下一個 sortOrder
        const maxSortOrder = await CheckList.max('sortOrder') || 0;

        const data = await CheckList.create({
            id: uuidv4(),
            name,
            description,
            isActive,
            sortOrder: maxSortOrder + 1
        });

        return res.status(201).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 更新檢查清單
const updateCheckList = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;

        const checkList = await CheckList.findByPk(req.params.id);
        if (!checkList) {
            return res.status(404).json({ message: 'Checklist not found', success: false });
        }

        // 如果更改名稱，檢查是否與其他項目重複
        if (name && name !== checkList.name) {
            const existingCheckList = await CheckList.findOne({
                where: { 
                    name,
                    id: { [Op.ne]: req.params.id }
                }
            });

            if (existingCheckList) {
                return res.status(400).json({ message: 'Checklist with this name already exists', success: false });
            }
        }

        await checkList.update({
            name,
            description,
            isActive
        });

        return res.status(200).json({ data: checkList, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 刪除檢查清單
const deleteCheckList = async (req, res) => {
    try {
        const checkList = await CheckList.findByPk(req.params.id);
        if (!checkList) {
            return res.status(404).json({ message: 'Checklist not found', success: false });
        }

        // 檢查是否有交易記錄正在使用此檢查清單
        const usageCount = await TradingRecordCheckList.count({
            where: { checkListId: req.params.id }
        });

        if (usageCount > 0) {
            return res.status(400).json({ 
                message: `Cannot delete checklist. It is being used by ${usageCount} trading record(s).`,
                success: false,
                data: { usageCount }
            });
        }

        await checkList.destroy();

        return res.status(200).json({ message: 'Checklist deleted successfully', success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 切換啟用狀態
const toggleCheckList = async (req, res) => {
    try {
        const checkList = await CheckList.findByPk(req.params.id);
        if (!checkList) {
            return res.status(404).json({ message: 'Checklist not found', success: false });
        }

        await checkList.update({
            isActive: !checkList.isActive
        });

        return res.status(200).json({ data: checkList, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 根據 ID 陣列順序重新排序
const reorderCheckListsByIds = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const { ids } = req.body; // ['id1', 'id2', 'id3', ...]

        if (!Array.isArray(ids) || ids.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ message: 'IDs must be a non-empty array', success: false });
        }

        // 驗證所有 ID 都存在
        const existingCheckLists = await CheckList.findAll({
            where: { id: { [Op.in]: ids } },
            transaction
        });

        if (existingCheckLists.length !== ids.length) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Some checklist IDs do not exist', success: false });
        }

        // 根據陣列順序更新 sortOrder
        const updates = ids.map((id, index) => 
            CheckList.update(
                { sortOrder: index + 1 },
                { 
                    where: { id },
                    transaction 
                }
            )
        );

        await Promise.all(updates);
        await transaction.commit();

        return res.status(200).json({ message: 'Checklist order updated successfully', success: true });
    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 批次更新排序（保留舊版本以防需要）
const reorderCheckLists = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const { items } = req.body; // [{ id, sortOrder }, ...]

        if (!Array.isArray(items)) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Items must be an array', success: false });
        }

        // 批次更新排序
        const updates = items.map(item => 
            CheckList.update(
                { sortOrder: item.sortOrder },
                { 
                    where: { id: item.id },
                    transaction 
                }
            )
        );

        await Promise.all(updates);
        await transaction.commit();

        return res.status(200).json({ message: 'Checklist order updated successfully', success: true });
    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 取得檢查清單使用統計
const getCheckListUsage = async (req, res) => {
    try {
        const checkList = await CheckList.findByPk(req.params.id);
        if (!checkList) {
            return res.status(404).json({ message: 'Checklist not found', success: false });
        }

        const usageCount = await TradingRecordCheckList.count({
            where: { checkListId: req.params.id }
        });

        const recentUsage = await TradingRecordCheckList.findAll({
            where: { checkListId: req.params.id },
            include: [{
                model: TradingRecord,
                as: 'tradingRecord',
                include: [{
                    model: Stock,
                    as: 'stock',
                    attributes: ['code', 'name']
                }],
                attributes: ['id', 'stockCode', 'buyPrice', 'status', 'createdAt']
            }],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        const data = {
            checkList,
            usageCount,
            recentUsage
        };

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    getAllCheckLists,
    getActiveCheckLists,
    getCheckListById,
    createCheckList,
    updateCheckList,
    deleteCheckList,
    toggleCheckList,
    reorderCheckLists,
    reorderCheckListsByIds,
    getCheckListUsage
};