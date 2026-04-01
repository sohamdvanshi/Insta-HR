require('dotenv').config();
const sequelize = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const hash = await bcrypt.hash('Admin@123', 10);
  
  await sequelize.query(`
    INSERT INTO "Users" (id, email, password, role, "isEmailVerified", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'admin@instahire.com', '${hash}', 'admin', true, true, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET password = '${hash}', role = 'admin'
  `);
  
  console.log('Admin account ready!');
  console.log('Email: admin@instahire.com');
  console.log('Password: Admin@123');
  process.exit();
}

createAdmin().catch(e => { console.error(e.message); process.exit(); });