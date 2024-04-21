'use strict';
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('News', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            sort: {
                allowNull: false,
                type: Sequelize.INTEGER,
            },
            name: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            date: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            content: {
                allowNull: true,
                type: Sequelize.STRING,
            },
            fromWhere: {
                allowNull: true,
                type: Sequelize.STRING,
            },
            rate:{
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 1,
            },
            type: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 1,
                comment: '1: 利多, 2: 利空, 3: 中立',
            },
            status: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 1,
                comment:
                    '1: 時間未到, 2: 提前完成, 3: 準時完成, 4:延後完成 , 5: 延後未完, 6: 狀況不明, 7: 悲觀延後, 8: 樂觀準時',
            },
            targetId: {
                allowNull: false,
                type: Sequelize.UUID,
                onDelete: 'CASCADE',
                references: {
                    model: 'Targets',
                    key: 'id',
                    as: 'targetId',
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
        await queryInterface.dropTable('News');
    },
};
