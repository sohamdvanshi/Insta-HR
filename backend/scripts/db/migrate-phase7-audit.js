const sequelize = require('../../src/config/database');
(async () => {
  try {
    await sequelize.authenticate();
    await require('../../migrations/20261010000100-phase7-audit').up(sequelize.getQueryInterface(), require('sequelize'));
    console.log('Phase 7 audit schema is ready.');
  } finally { await sequelize.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
