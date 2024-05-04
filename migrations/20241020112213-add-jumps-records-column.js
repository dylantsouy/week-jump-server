'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.renameColumn('JumpsRecords', 'price', 'lastPrice');

        await queryInterface.addColumn('JumpsRecords', 'jumpPrice', {
            allowNull: false,
            type: Sequelize.FLOAT,
            after: 'lastPrice',
        });
        await queryInterface.addColumn('JumpsRecords', 'lastValue', {
            allowNull: false,
            type: Sequelize.INTEGER,
            after: 'type',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('JumpsRecords', 'lastValue');
        await queryInterface.removeColumn('JumpsRecords', 'jumpPrice');
        await queryInterface.renameColumn('JumpsRecords', 'lastPrice', 'price');
    },
};