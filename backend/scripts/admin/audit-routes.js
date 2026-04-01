// Admin: audits all registered routes and file structure in src/
// Run from backend/: node scripts/admin/audit-routes.js
const fs = require('fs');
const path = require('path');
const srcBase = path.join(__dirname, '../../src');

const server = fs.readFileSync(path.join(srcBase,'server.js'), 'utf8');

const expected = ['/api/v1/auth','/api/v1/jobs','/api/v1/applications','/api/v1/candidates','/api/v1/employers','/api/v1/payments','/api/v1/training','/api/v1/jobs-actions','/api/v1/ai'];

console.log('======= ROUTE AUDIT =======');
let allGood = true;
expected.forEach(route => {
  const found = server.includes(route);
  console.log((found ? '✅' : '❌') + ' ' + route);
  if (!found) allGood = false;
});

console.log('\n======= ROUTE FILES =======');
fs.readdirSync(path.join(srcBase,'routes')).forEach(f => console.log('  📄 ' + f));
console.log('\n======= CONTROLLER FILES =======');
fs.readdirSync(path.join(srcBase,'controllers')).forEach(f => console.log('  📄 ' + f));
console.log('\n======= MODEL FILES =======');
fs.readdirSync(path.join(srcBase,'models')).forEach(f => console.log('  📄 ' + f));
console.log('\n' + (allGood ? '✅ ALL ROUTES REGISTERED!' : '⚠️  SOME ROUTES MISSING!'));
