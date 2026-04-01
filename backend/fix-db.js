require('dotenv').config();
const sequelize = require('./src/config/database');

async function fix() {
  try {
    // Add missing columns to Users table
    await sequelize.query(`
      ALTER TABLE "Users" 
      ADD COLUMN IF NOT EXISTS "subscriptionExpiry" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "subscriptionPlan" VARCHAR(255) DEFAULT 'free';
    `);
    console.log('✅ subscriptionExpiry + subscriptionPlan columns added to Users table');

    // Create Payments table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Payments" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "orderId" VARCHAR(255) NOT NULL,
        "paymentId" VARCHAR(255),
        amount FLOAT NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        plan VARCHAR(50) NOT NULL,
        "planName" VARCHAR(255),
        status VARCHAR(50) DEFAULT 'created',
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Payments table created (or already exists)');

    // Create EmployerProfiles table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "EmployerProfiles" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL UNIQUE,
        "companyName" VARCHAR(255) NOT NULL,
        "logoUrl" VARCHAR(255),
        "logoPublicId" VARCHAR(255),
        tagline VARCHAR(255),
        about TEXT,
        industry VARCHAR(100),
        "companySize" VARCHAR(50) DEFAULT '1-10',
        website VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'India',
        "linkedinUrl" VARCHAR(255),
        "twitterUrl" VARCHAR(255),
        "isVerified" BOOLEAN DEFAULT false,
        "foundedYear" INTEGER,
        "totalJobsPosted" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ EmployerProfiles table created (or already exists)');

    console.log('\n🎉 All done! Restart backend: npm run dev');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fix();