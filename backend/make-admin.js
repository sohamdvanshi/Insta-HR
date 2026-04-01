require('dotenv').config();
const sequelize = require('./src/config/database');

const email = 'your@email.com'; // change this to your email

sequelize.query(`UPDATE "Users" SET role = 'admin' WHERE email = '${email}'`)
  .then(() => {
    console.log('Done! User is now admin.');
    process.exit();
  })
  .catch(e => {
    console.error('Error:', e.message);
    process.exit();
  });