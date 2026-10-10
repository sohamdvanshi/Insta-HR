const sequelize = require('../../src/config/database');
(async () => {
  try { await sequelize.authenticate(); await require('../../migrations/20261006000100-wage-register').up(sequelize.getQueryInterface(), require('sequelize')); console.log('Attendance wage register schema is ready.'); }
  finally { await sequelize.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
