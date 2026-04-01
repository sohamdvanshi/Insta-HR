// Admin: checks User model field names
// Run from backend/: node scripts/admin/check-user.js
const fs = require('fs');
const path = require('path');

const model = fs.readFileSync(path.join(__dirname,'../../src/models/User.js'), 'utf8');
const fieldLines = model.split('\n').filter(l => l.includes('DataTypes') || l.includes('type:'));
console.log('User model fields:');
fieldLines.forEach(l => console.log(' ', l.trim()));
