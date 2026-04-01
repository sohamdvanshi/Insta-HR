// Admin: creates first admin user in DB
// Run from backend/: node scripts/admin/create-admin.js
require('dotenv').config();
const sequelize = require('../../src/config/database');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query(
      `INSERT INTO "Users" (name, email, password, role, "createdAt", "updatedAt")
       VALUES ('Admin', 'admin@instahr.com', $1, 'admin', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET role = 'admin'
       RETURNING id, email, role`,
      { bind: [await bcrypt.hash('Admin@123', 12)] }
    );
    console.log('✅ Admin user ready:', results[0]);
    console.log('   Email: admin@instahr.com | Password: Admin@123');
    process.exit(0);
  } catch (err) { console.error('❌ Error:', err.message); process.exit(1); }
}

createAdmin();
