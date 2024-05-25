'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('ObservesRecords', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            date: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            type: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 1,
                comment: '1: 觀察, 2: 稍微觀察',
            },
            price: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            observeId: {
                allowNull: false,
                type: Sequelize.UUID,
                onDelete: 'CASCADE',
                references: {
                    model: 'Observes',
                    key: 'id',
                    as: 'observeId',
                },
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
        await queryInterface.dropTable('ObservesRecords');
    },
};
