require('dotenv').config();
const sequelize = require('./src/config/database');

sequelize.query('DROP TABLE IF EXISTS "Trainings" CASCADE')
  .then(() => { console.log('Dropped!'); process.exit(); })
  .catch(e => { console.error(e.message); process.exit(); });