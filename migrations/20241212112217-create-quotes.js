'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Quotes', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            sentence:{
                allowNull: false,
                type: Sequelize.STRING,
            },
            fromWho:{
                allowNull: true,
                type: Sequelize.STRING,
                defaultValue: '',
            },
            note:{
                allowNull: true,
                type: Sequelize.STRING,
                defaultValue: '',
            },
            type:{
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
        await queryInterface.dropTable('Quotes');
    },
};
