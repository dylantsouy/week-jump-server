'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Trackings', 'sort');
        await queryInterface.removeColumn('Trackings', 'date');
        await queryInterface.removeColumn('Trackings', 'content');
        await queryInterface.removeColumn('Trackings', 'fromWhere');
        await queryInterface.removeColumn('Trackings', 'type');
        await queryInterface.removeColumn('Trackings', 'newsId');
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.addColumn('Trackings', 'sort', {
            allowNull: false,
            type: Sequelize.INTEGER,
        });
        await queryInterface.addColumn('Trackings', 'date', {
            allowNull: false,
            type: Sequelize.DATE,
        });
        await queryInterface.addColumn('Trackings', 'content', {
            allowNull: true,
            type: Sequelize.TEXT,
        });
        await queryInterface.addColumn('Trackings', 'fromWhere', {
            allowNull: true,
            type: Sequelize.STRING,
        });
        await queryInterface.addColumn('Trackings', 'type', {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 1,
            comment: '1: 利多, 2: 利空, 3: 中立',
        });
        await queryInterface.addColumn('Trackings', 'newsId', {
            allowNull: false,
            type: Sequelize.UUID,
            onDelete: 'CASCADE',
            references: {
                model: 'News',
                key: 'id',
                as: 'newsId',
            },
        });
    },
};