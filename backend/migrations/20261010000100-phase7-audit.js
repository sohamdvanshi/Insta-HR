'use strict';
module.exports = {
  async up(q, S) {
    return q.sequelize.transaction(async transaction => {
      const options = { transaction };
      const columns = await q.describeTable('candidateprofiles', options);
      for (const [name, length] of [['photoUrl', 2048], ['photoPublicId', 255], ['resumePublicId', 255]]) {
        if (!columns[name]) await q.addColumn('candidateprofiles', name, { type: S.STRING(length), allowNull: true }, options);
      }
    });
  },
  async down() { throw new Error('Uploaded profile assets must be preserved. Restore a backup to roll back.'); }
};
