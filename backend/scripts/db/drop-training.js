// DB: drops training-related tables
// Run from backend/: node scripts/db/drop-training.js
require('dotenv').config();
const sequelize = require('../../src/config/database');

async function drop() {
  try {
    await sequelize.query('DROP TABLE IF EXISTS "Trainings" CASCADE;');
    console.log('✅ Trainings table dropped');
    process.exit(0);
  } catch (err) { console.error('❌ Error:', err.message); process.exit(1); }
}

drop();
