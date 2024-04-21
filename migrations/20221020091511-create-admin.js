'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Admins', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
            },
            email: {
                allowNull: false,
                type: Sequelize.STRING,
                unique: true,
            },
            password: {
                allowNull: false,
                type: Sequelize.STRING(64),
            },
            name:{
                allowNull: false,
                type: Sequelize.STRING,
            },
            role: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 3,
                comment: '1: manager, 2: editor, 3: viewer',
            },
            lastLoginAt: {
                type: Sequelize.DATE,
                defaultValue: null,
            },
            loginCount: {
                type: Sequelize.INTEGER,
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
        await queryInterface.dropTable('Admins');
    },
};
