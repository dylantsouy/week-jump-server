'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Loans', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            previousBalance: {
                type: Sequelize.BIGINT,
                allowNull: false,
            },
            currentBalance: {
                type: Sequelize.BIGINT,
                allowNull: false,
            },
            change: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            recordDate: {
                type: Sequelize.DATE,
                allowNull: false,
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
        await queryInterface.dropTable('Loans');
    },
};
