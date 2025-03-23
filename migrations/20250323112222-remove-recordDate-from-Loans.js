'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Loans', 'recordDate');
  },


  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Loans', 'recordDate', {
      type: Sequelize.DATE,
      allowNull: false
    });
  }
};
