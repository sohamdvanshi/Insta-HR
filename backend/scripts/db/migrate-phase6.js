const sequelize = require('../../src/config/database');
const S = require('sequelize');
(async () => {
  try {
    await sequelize.authenticate();
    await require('../../migrations/20261004000100-training-classes').up(sequelize.getQueryInterface(), S);
    await require('../../migrations/20261005000100-admin-controls').up(sequelize.getQueryInterface(), S);
    console.log('Phase 6 admin schema is ready.');
  } finally { await sequelize.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
