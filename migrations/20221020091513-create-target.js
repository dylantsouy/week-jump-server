'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Targets', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            rate: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 5,
                comment:
                    '1: 持有, 2: 看好, 3: 有機會, 4: 需等待, 5: 待觀察, 6: 中立, 7: 已反應, 8: 有風險, 9: 中立偏空, 10: 不看好',
            },
            initPrice: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
            },
            sort:{
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            eps:{
                type: Sequelize.JSON,
            },
            averagePE:{
                type: Sequelize.STRING,
            },
            CAGR:{
                type: Sequelize.STRING,
            },
            yield:{
                type: Sequelize.STRING,
            },
            stockCode: {
              allowNull: false,
              type: Sequelize.STRING,
              onDelete: 'CASCADE',
              references: {
                model: 'Stocks',
                key: 'code',
                as: 'stockCode',
              }
            },
            deadline:{
                type: Sequelize.STRING,
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
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('Targets');
    },
};
