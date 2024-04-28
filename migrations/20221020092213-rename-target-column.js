'use strict';
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {  

        await queryInterface.renameColumn('Targets', 'avergePE', 'averagePE')
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.renameColumn('Targets', 'averagePE', 'avergePE')
    },
};
