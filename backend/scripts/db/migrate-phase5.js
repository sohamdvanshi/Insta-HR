const sequelize = require('../../src/config/database');
const S = require('sequelize');
async function run() {
  try {
    await sequelize.authenticate();
    await require('../../migrations/20261004000100-training-classes').up(sequelize.getQueryInterface(), S);
    console.log('Phase 5 training schema is ready.');
  } finally { await sequelize.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
