'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('ObservesRecords', 'reason', {
            type: Sequelize.STRING,
            after: 'price',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('ObservesRecords', 'reason');
    },
};