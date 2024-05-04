'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('JumpsRecords', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            type: {
                allowNull: false,
                type: Sequelize.ENUM,
                values: ['d', 'w', 'm'],
                defaultValue: 'd',
                comment: 'd: 日跳, w: 周跳, m: 月跳',
            },
            price: {
                allowNull: false,
                type: Sequelize.FLOAT,
            },
            closed: {
                allowNull: false,
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            date: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            jumpId: {
                allowNull: false,
                type: Sequelize.UUID,
                onDelete: 'CASCADE',
                references: {
                    model: 'Jumps',
                    key: 'id',
                    as: 'jumpId',
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
        await queryInterface.dropTable('JumpsRecords');
    },
};
