'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('TradingRecords', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            stockCode: {
                allowNull: false,
                type: Sequelize.STRING,
                references: {
                    model: 'Stocks',
                    key: 'code',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            buyReasonId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: {
                    model: 'BuyReasons',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
            },
            buyPrice: {
                allowNull: false,
                type: Sequelize.FLOAT,
            },
            quantity: {
                allowNull: false,
                type: Sequelize.INTEGER,
            },
            stopLoss: {
                allowNull: false,
                type: Sequelize.FLOAT,
                comment: '停損點',
            },
            targetPrice: {
                allowNull: false,
                type: Sequelize.FLOAT,
                comment: '滿足點',
            },
            addPositionTrigger: {
                type: Sequelize.FLOAT,
                comment: '加碼時機價格',
            },
            addPositionCondition: {
                type: Sequelize.TEXT,
                comment: '加碼條件描述',
            },
            emotion: {
                type: Sequelize.TEXT,
                comment: '當時情緒狀態',
            },
            mistakes: {
                type: Sequelize.TEXT,
                comment: '錯誤點分析',
            },
            result: {
                type: Sequelize.TEXT,
                comment: '結果檢討',
            },
            status: {
                type: Sequelize.ENUM('HOLDING', 'SOLD', 'STOP_LOSS'),
                defaultValue: 'HOLDING',
            },
            sellPrice: {
                type: Sequelize.FLOAT,
                comment: '賣出價格',
            },
            sellDate: {
                type: Sequelize.DATE,
                comment: '賣出日期',
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            deletedAt: {
                type: Sequelize.DATE,
            },
        });

        // 建立索引
        await queryInterface.addIndex('TradingRecords', ['stockCode']);
        await queryInterface.addIndex('TradingRecords', ['buyReasonId']);
        await queryInterface.addIndex('TradingRecords', ['status']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('TradingRecords');
    },
};
