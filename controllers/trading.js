const { TradingRecord, TradingRecordCheckList, CheckList, Stock, BuyReason } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');

// 取得所有交易記錄
const getAllTradingRecords = async (req, res) => {
    try {
        const { 
            status, 
            stockCode, 
            startDate, 
            endDate, 
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const where = {};

        // 狀態篩選
        if (status) {
            where.status = status;
        }

        // 股票代碼篩選
        if (stockCode) {
            where.stockCode = { [Op.like]: `%${stockCode}%` };
        }

        // 日期範圍篩選
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const data = await TradingRecord.findAll({
            where,
            include: [
                {
                    model: Stock,
                    as: 'stock',
                    attributes: ['code', 'name', 'market']
                },
                {
                    model: BuyReason,
                    as: 'buyReason',
                    attributes: ['id', 'name']
                },
                {
                    model: TradingRecordCheckList,
                    as: 'checkLists',
                    include: [{
                        model: CheckList,
                        as: 'checkList',
                        attributes: ['id', 'name']
                    }]
                }
            ],
            order: [[sortBy, sortOrder]]
        });

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 取得單一交易記錄
const getTradingRecordById = async (req, res) => {
    try {
        const data = await TradingRecord.findByPk(req.params.id, {
            include: [
                {
                    model: Stock,
                    as: 'stock',
                    attributes: ['code', 'name', 'market', 'industry']
                },
                {
                    model: BuyReason,
                    as: 'buyReason',
                    attributes: ['id', 'name', 'description']
                },
                {
                    model: TradingRecordCheckList,
                    as: 'checkLists',
                    include: [{
                        model: CheckList,
                        as: 'checkList',
                        attributes: ['id', 'name', 'description']
                    }]
                }
            ]
        });

        if (!data) {
            return res.status(404).json({ message: 'Trading record not found', success: false });
        }

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 建立交易記錄
const createTradingRecord = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const {
            stockCode,
            buyPrice,
            buyQuantity,
            buyDate,
            buyReasonId,
            notes,
            targetPrice,
            stopLossPrice,
            checkListIds = []
        } = req.body;

        // 驗證必填欄位
        if (!stockCode || !buyPrice || !buyQuantity) {
            await transaction.rollback();
            return res.status(400).json({ 
                message: 'Stock code, buy price, and buy quantity are required', 
                success: false 
            });
        }

        // 驗證股票是否存在
        const stock = await Stock.findOne({ where: { code: stockCode } });
        if (!stock) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Stock not found', success: false });
        }

        // 驗證購買原因是否存在（如果有提供）
        if (buyReasonId) {
            const buyReason = await BuyReason.findByPk(buyReasonId);
            if (!buyReason) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Buy reason not found', success: false });
            }
        }

        // 建立交易記錄
        const tradingRecord = await TradingRecord.create({
            id: uuidv4(),
            stockCode,
            buyPrice: parseFloat(buyPrice),
            buyQuantity: parseInt(buyQuantity),
            buyDate: buyDate || new Date(),
            buyReasonId,
            notes,
            targetPrice: targetPrice ? parseFloat(targetPrice) : null,
            stopLossPrice: stopLossPrice ? parseFloat(stopLossPrice) : null,
            status: 'HOLDING',
            totalBuyAmount: parseFloat(buyPrice) * parseInt(buyQuantity)
        }, { transaction });

        // 建立檢查清單關聯
        if (checkListIds.length > 0) {
            // 驗證檢查清單是否存在且啟用
            const checkLists = await CheckList.findAll({
                where: { 
                    id: { [Op.in]: checkListIds },
                    isActive: true 
                }
            });

            if (checkLists.length !== checkListIds.length) {
                await transaction.rollback();
                return res.status(400).json({ 
                    message: 'Some check lists not found or inactive', 
                    success: false 
                });
            }

            const checkListRecords = checkListIds.map(checkListId => ({
                id: uuidv4(),
                tradingRecordId: tradingRecord.id,
                checkListId,
                isChecked: false
            }));

            await TradingRecordCheckList.bulkCreate(checkListRecords, { transaction });
        }

        await transaction.commit();

        // 重新查詢完整資料
        const data = await TradingRecord.findByPk(tradingRecord.id, {
            include: [
                {
                    model: Stock,
                    as: 'stock',
                    attributes: ['code', 'name', 'market']
                },
                {
                    model: BuyReason,
                    as: 'buyReason',
                    attributes: ['id', 'name']
                },
                {
                    model: TradingRecordCheckList,
                    as: 'checkLists',
                    include: [{
                        model: CheckList,
                        as: 'checkList',
                        attributes: ['id', 'name']
                    }]
                }
            ]
        });

        return res.status(201).json({ data, success: true });
    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 更新交易記錄
const updateTradingRecord = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const {
            buyPrice,
            buyQuantity,
            buyDate,
            buyReasonId,
            notes,
            targetPrice,
            stopLossPrice,
            sellPrice,
            sellQuantity,
            sellDate,
            status,
            checkListIds
        } = req.body;

        const tradingRecord = await TradingRecord.findByPk(req.params.id, { transaction });
        if (!tradingRecord) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Trading record not found', success: false });
        }

        // 驗證購買原因是否存在（如果有提供）
        if (buyReasonId) {
            const buyReason = await BuyReason.findByPk(buyReasonId);
            if (!buyReason) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Buy reason not found', success: false });
            }
        }

        // 更新交易記錄
        const updateData = {};
        if (buyPrice !== undefined) updateData.buyPrice = parseFloat(buyPrice);
        if (buyQuantity !== undefined) updateData.buyQuantity = parseInt(buyQuantity);
        if (buyDate !== undefined) updateData.buyDate = buyDate;
        if (buyReasonId !== undefined) updateData.buyReasonId = buyReasonId;
        if (notes !== undefined) updateData.notes = notes;
        if (targetPrice !== undefined) updateData.targetPrice = targetPrice ? parseFloat(targetPrice) : null;
        if (stopLossPrice !== undefined) updateData.stopLossPrice = stopLossPrice ? parseFloat(stopLossPrice) : null;
        if (sellPrice !== undefined) updateData.sellPrice = sellPrice ? parseFloat(sellPrice) : null;
        if (sellQuantity !== undefined) updateData.sellQuantity = sellQuantity ? parseInt(sellQuantity) : null;
        if (sellDate !== undefined) updateData.sellDate = sellDate;
        if (status !== undefined) updateData.status = status;

        // 重新計算總購買金額
        if (buyPrice !== undefined || buyQuantity !== undefined) {
            const finalBuyPrice = buyPrice !== undefined ? parseFloat(buyPrice) : tradingRecord.buyPrice;
            const finalBuyQuantity = buyQuantity !== undefined ? parseInt(buyQuantity) : tradingRecord.buyQuantity;
            updateData.totalBuyAmount = finalBuyPrice * finalBuyQuantity;
        }

        // 計算總賣出金額和損益
        if (sellPrice !== undefined || sellQuantity !== undefined) {
            const finalSellPrice = sellPrice !== undefined ? parseFloat(sellPrice) : tradingRecord.sellPrice;
            const finalSellQuantity = sellQuantity !== undefined ? parseInt(sellQuantity) : tradingRecord.sellQuantity;
            
            if (finalSellPrice && finalSellQuantity) {
                updateData.totalSellAmount = finalSellPrice * finalSellQuantity;
                updateData.profit = updateData.totalSellAmount - (tradingRecord.totalBuyAmount || updateData.totalBuyAmount);
                updateData.profitRate = (updateData.profit / (tradingRecord.totalBuyAmount || updateData.totalBuyAmount)) * 100;
            }
        }

        await tradingRecord.update(updateData, { transaction });

        // 更新檢查清單關聯（如果有提供）
        if (checkListIds !== undefined && Array.isArray(checkListIds)) {
            // 刪除現有關聯
            await TradingRecordCheckList.destroy({
                where: { tradingRecordId: req.params.id },
                transaction
            });

            // 建立新關聯
            if (checkListIds.length > 0) {
                const checkLists = await CheckList.findAll({
                    where: { 
                        id: { [Op.in]: checkListIds },
                        isActive: true 
                    }
                });

                if (checkLists.length !== checkListIds.length) {
                    await transaction.rollback();
                    return res.status(400).json({ 
                        message: 'Some check lists not found or inactive', 
                        success: false 
                    });
                }

                const checkListRecords = checkListIds.map(checkListId => ({
                    id: uuidv4(),
                    tradingRecordId: req.params.id,
                    checkListId,
                    isChecked: false
                }));

                await TradingRecordCheckList.bulkCreate(checkListRecords, { transaction });
            }
        }

        await transaction.commit();

        // 重新查詢完整資料
        const data = await TradingRecord.findByPk(req.params.id, {
            include: [
                {
                    model: Stock,
                    as: 'stock',
                    attributes: ['code', 'name', 'market']
                },
                {
                    model: BuyReason,
                    as: 'buyReason',
                    attributes: ['id', 'name']
                },
                {
                    model: TradingRecordCheckList,
                    as: 'checkLists',
                    include: [{
                        model: CheckList,
                        as: 'checkList',
                        attributes: ['id', 'name']
                    }]
                }
            ]
        });

        return res.status(200).json({ data, success: true });
    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 刪除交易記錄
const deleteTradingRecord = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const tradingRecord = await TradingRecord.findByPk(req.params.id, { transaction });
        if (!tradingRecord) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Trading record not found', success: false });
        }

        // 刪除相關的檢查清單記錄
        await TradingRecordCheckList.destroy({
            where: { tradingRecordId: req.params.id },
            transaction
        });

        // 刪除交易記錄
        await tradingRecord.destroy({ transaction });

        await transaction.commit();

        return res.status(200).json({ message: 'Trading record deleted successfully', success: true });
    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 更新檢查清單狀態
const updateCheckListStatus = async (req, res) => {
    try {
        const { checkListId, isChecked } = req.body;
        const { id: tradingRecordId } = req.params;

        const checkListRecord = await TradingRecordCheckList.findOne({
            where: { 
                tradingRecordId,
                checkListId 
            }
        });

        if (!checkListRecord) {
            return res.status(404).json({ message: 'Check list record not found', success: false });
        }

        await checkListRecord.update({ isChecked });

        return res.status(200).json({ data: checkListRecord, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

// 取得交易統計
const getTradingStatistics = async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        const where = {};

        if (status) where.status = status;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const totalRecords = await TradingRecord.count({ where });
        
        const statusCounts = await TradingRecord.findAll({
            attributes: [
                'status',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where,
            group: ['status']
        });

        const profitStats = await TradingRecord.findAll({
            attributes: [
                [db.sequelize.fn('SUM', db.sequelize.col('profit')), 'totalProfit'],
                [db.sequelize.fn('AVG', db.sequelize.col('profitRate')), 'avgProfitRate'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'soldCount']
            ],
            where: {
                ...where,
                status: 'SOLD',
                profit: { [Op.ne]: null }
            }
        });

        const data = {
            totalRecords,
            statusCounts: statusCounts.reduce((acc, item) => {
                acc[item.status] = parseInt(item.dataValues.count);
                return acc;
            }, {}),
            profitStats: profitStats[0] ? {
                totalProfit: parseFloat(profitStats[0].dataValues.totalProfit) || 0,
                avgProfitRate: parseFloat(profitStats[0].dataValues.avgProfitRate) || 0,
                soldCount: parseInt(profitStats[0].dataValues.soldCount) || 0
            } : { totalProfit: 0, avgProfitRate: 0, soldCount: 0 }
        };

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    getAllTradingRecords,
    getTradingRecordById,
    createTradingRecord,
    updateTradingRecord,
    deleteTradingRecord,
    updateCheckListStatus,
    getTradingStatistics
};