'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Loans', 'marginRateChange', {
      type: Sequelize.FLOAT,
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Loans', 'marginRateChange', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
  }
};
