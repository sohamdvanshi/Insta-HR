'use strict';
module.exports = {
  async up(q, S) {
    return q.sequelize.transaction(async transaction => {
      const options = { transaction };
      await q.sequelize.query('SELECT pg_advisory_xact_lock(61010003)', options);
      await q.describeTable('Users', options);
      const columns = await q.describeTable('candidateprofiles', options);
      for (const name of ['preferredLocations', 'preferredJobTypes']) {
        if (!columns[name]) await q.addColumn('candidateprofiles', name, { type: S.JSONB, allowNull: false, defaultValue: [] }, options);
      }
      const keys = (await q.getForeignKeyReferencesForTable('candidateprofiles', options)).filter(key => key.columnName === 'userId');
      for (const key of keys) {
        if (key.referencedTableName !== 'Users' || key.referencedColumnName !== 'id') await q.removeConstraint('candidateprofiles', key.constraintName, options);
      }
      const correct = keys.find(key => key.referencedTableName === 'Users' && key.referencedColumnName === 'id');
      const name = correct?.constraintName || 'candidateprofiles_userId_Users_fkey';
      const quoted = q.queryGenerator.quoteIdentifier(name);
      if (!correct) {
        // Preserve historical orphan rows while enforcing every new/changed userId.
        await q.sequelize.query(`ALTER TABLE "candidateprofiles" ADD CONSTRAINT ${quoted} FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID`, options);
      }
      const [rows] = await q.sequelize.query('SELECT COUNT(*) AS count FROM "candidateprofiles" p LEFT JOIN "Users" u ON u.id = p."userId" WHERE p."userId" IS NOT NULL AND u.id IS NULL', options);
      const orphanCount = Number(rows[0]?.count || 0);
      if (!orphanCount) await q.sequelize.query(`ALTER TABLE "candidateprofiles" VALIDATE CONSTRAINT ${quoted}`, options);
      return { orphanCount };
    });
  },
  async down() { throw new Error('Candidate profiles and preferences are preserved. Restore a backup to roll back.'); }
};
