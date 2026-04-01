const fs = require('fs');

// Check User model to find correct field names
const userModel = fs.readFileSync('src/models/User.js', 'utf8');
console.log('User model:\n', userModel);