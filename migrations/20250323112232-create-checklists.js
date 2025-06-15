'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 建立 CheckLists 表
        await queryInterface.createTable('CheckLists', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            name: {
                allowNull: false,
                type: Sequelize.STRING,
                unique: true,
            },
            description: {
                type: Sequelize.TEXT,
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            sortOrder: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
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

        // 建立 TradingRecordCheckLists 關聯表 (多對多)
        await queryInterface.createTable('TradingRecordCheckLists', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            tradingRecordId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: {
                    model: 'TradingRecords',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            checkListId: {
                allowNull: false,
                type: Sequelize.UUID,
                references: {
                    model: 'CheckLists',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            isChecked: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            notes: {
                type: Sequelize.TEXT,
                comment: '針對此項目的備註',
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });

        // 建立索引
        await queryInterface.addIndex('CheckLists', ['isActive']);
        await queryInterface.addIndex('CheckLists', ['sortOrder']);
        await queryInterface.addIndex('TradingRecordCheckLists', ['tradingRecordId']);
        await queryInterface.addIndex('TradingRecordCheckLists', ['checkListId']);
        
        // 建立複合唯一索引，避免重複關聯
        await queryInterface.addIndex('TradingRecordCheckLists', {
            fields: ['tradingRecordId', 'checkListId'],
            unique: true,
            name: 'unique_trading_record_checklist'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('TradingRecordCheckLists');
        await queryInterface.dropTable('CheckLists');
    },
};