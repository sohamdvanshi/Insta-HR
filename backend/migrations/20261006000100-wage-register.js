module.exports.up = async (q, S) => {
  await q.sequelize.transaction(async transaction => {
    await q.sequelize.query("SELECT pg_advisory_xact_lock(61006001)", { transaction });
    const tables = await q.showAllTables({ transaction });
    const exists = tables.some(t => (typeof t === 'string' ? t : t.tableName) === 'wage_registers');
    if (!exists) {
    await q.createTable('wage_registers', {
      id: { type: S.UUID, primaryKey: true, allowNull: false }, employerId: { type: S.UUID, allowNull: false, references: { model: 'Users', key: 'id' } },
      period: { type: S.STRING(7), allowNull: false }, site: { type: S.STRING(100), allowNull: false }, status: { type: S.STRING(20), allowNull: false, defaultValue: 'draft' },
      version: { type: S.INTEGER, allowNull: false, defaultValue: 1 }, sourceHash: { type: S.STRING(64), allowNull: false }, sourceName: { type: S.STRING(255), allowNull: false },
      rows: { type: S.JSONB, allowNull: false }, warnings: { type: S.JSONB, allowNull: false, defaultValue: [] }, approvedAt: { type: S.DATE, allowNull: true },
      createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false }
    }, { transaction });
    await q.addIndex('wage_registers', ['employerId','period','site'], { unique: true, transaction });
    } else {
      // Repair the first release's lowercase users reference. Preserve all rows.
      const keys = await q.getForeignKeyReferencesForTable('wage_registers', { transaction });
      const employerKeys = keys.filter(key => key.columnName === 'employerId');
      for (const key of employerKeys) {
        if (key.referencedTableName !== 'Users') await q.removeConstraint('wage_registers', key.constraintName, { transaction });
      }
      if (!employerKeys.some(key => key.referencedTableName === 'Users')) {
        await q.addConstraint('wage_registers', {
          fields: ['employerId'], type: 'foreign key', name: 'wage_registers_employerId_Users_fkey',
          references: { table: 'Users', field: 'id' }, transaction
        });
      }
    }
  });
};
