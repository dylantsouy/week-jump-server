'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Observes', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            initPrice: {
                type: Sequelize.STRING,
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
        await queryInterface.dropTable('Observes');
    },
};
