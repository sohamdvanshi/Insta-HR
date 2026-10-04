'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_resumes_sector" ADD VALUE IF NOT EXISTS 'human_resources'`);
  },
  async down() {
    // PostgreSQL cannot safely remove an enum value used by existing resumes.
    throw new Error('Forward-only migration: preserve existing Human Resources resumes.');
  }
};
