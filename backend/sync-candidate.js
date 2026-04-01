require('dotenv').config();
const sequelize = require('./src/config/database');

sequelize.query('DROP TABLE IF EXISTS "CandidateProfiles" CASCADE')
  .then(() => { console.log('Dropped! Restart backend to recreate.'); process.exit(); })
  .catch(e => { console.error(e.message); process.exit(); });