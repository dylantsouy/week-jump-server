'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Loans', 'initPrice', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false
    });
    await queryInterface.addColumn('Loans', 'marginRate', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Loans', 'initPrice');
    await queryInterface.removeColumn('Loans', 'marginRate');
  }
};
