'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Notes', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            title:{
                allowNull: false,
                type: Sequelize.STRING,
            },
            type:{
                allowNull: false,
                type: Sequelize.STRING,
            },
            content: {
                allowNull: true,
                type: Sequelize.STRING,
                defaultValue: '',
            },
            fromWho: {
                allowNull: true,
                type: Sequelize.STRING,
                defaultValue: '',
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
        await queryInterface.dropTable('Notes');
    },
};
