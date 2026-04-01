require('dotenv').config();
const sequelize = require('./src/config/database');

async function fix() {
  try {
    // Create SavedJobs table manually without FK constraint issues
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SavedJobs" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "jobId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "jobId")
      );
    `);
    console.log('✅ SavedJobs table created');

    // Create JobAlerts table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "JobAlerts" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        email VARCHAR(255) NOT NULL,
        keywords VARCHAR(255),
        location VARCHAR(255),
        industry VARCHAR(255),
        "jobType" VARCHAR(100),
        "isActive" BOOLEAN DEFAULT true,
        "lastSentAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ JobAlerts table created');

    console.log('\n🎉 Done! Restart backend: npm run dev');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fix();