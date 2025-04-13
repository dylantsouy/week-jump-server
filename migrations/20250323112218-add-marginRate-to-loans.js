'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('Loans', 'marginRate',
            {
                type: Sequelize.FLOAT,
                allowNull: false,
            },);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Loans', 'marginRate');
    }
};