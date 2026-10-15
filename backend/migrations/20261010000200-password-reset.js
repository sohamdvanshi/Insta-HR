'use strict';
module.exports = {
  async up(q, S) {
    return q.sequelize.transaction(async transaction => {
      const columns = await q.describeTable('Users', { transaction });
      const additions = {
        passwordResetTokenHash: { type: S.STRING(64), allowNull: true },
        passwordResetExpiresAt: { type: S.DATE, allowNull: true },
        authVersion: { type: S.INTEGER, allowNull: false, defaultValue: 0 }
      };
      for (const [name, definition] of Object.entries(additions)) {
        if (!columns[name]) await q.addColumn('Users', name, definition, { transaction });
      }
    });
  },
  async down() { throw new Error('Removing authVersion could reactivate revoked sessions. Restore a backup to roll back.'); }
};
