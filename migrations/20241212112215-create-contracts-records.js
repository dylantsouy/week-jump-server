'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('ContractsRecords', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            percentage: {
                allowNull: false,
                type: Sequelize.FLOAT,
            },
            contractValue: {
                allowNull: false,
                type: Sequelize.FLOAT,
            },
            qoq: {
                allowNull: false,
                type: Sequelize.FLOAT,
            },
            yoy: {
                allowNull: false,
                type: Sequelize.FLOAT,
            },
            quarter: {
                allowNull: false,
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
        await queryInterface.dropTable('ContractsRecords');
    },
};
