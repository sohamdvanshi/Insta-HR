require('dotenv').config();
const sequelize = require('../../src/config/database');
(async () => {
  try {
    await sequelize.authenticate();
    await require('../../migrations/20261010000200-password-reset').up(sequelize.getQueryInterface(), require('sequelize'));
    console.log('Password reset schema is ready.');
  } finally { await sequelize.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
