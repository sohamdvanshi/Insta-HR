'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.addColumn('jobs', 'isFeatured', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }),
      queryInterface.addColumn('jobs', 'featuredUntil', {
        type: Sequelize.DATE,
        allowNull: true
      })
    ]);
  },

  async down(queryInterface) {
    await Promise.all([
      queryInterface.removeColumn('jobs', 'isFeatured'),
      queryInterface.removeColumn('jobs', 'featuredUntil')
    ]);
  }
};