const fs = require('fs');

const server = fs.readFileSync('src/server.js', 'utf8');

const expected = [
  '/api/v1/auth',
  '/api/v1/jobs',
  '/api/v1/applications',
  '/api/v1/candidates',
  '/api/v1/employers',
  '/api/v1/payments',
  '/api/v1/training',
  '/api/v1/jobs-actions',
  '/api/v1/ai',
];

console.log('======= ROUTE AUDIT =======');
let allGood = true;
expected.forEach(route => {
  const found = server.includes(route);
  console.log((found ? '✅' : '❌') + ' ' + route);
  if (!found) allGood = false;
});

console.log('\n======= ROUTE FILES =======');
const routeFiles = fs.readdirSync('src/routes/');
routeFiles.forEach(f => console.log('  📄 ' + f));

console.log('\n======= CONTROLLER FILES =======');
const ctrlFiles = fs.readdirSync('src/controllers/');
ctrlFiles.forEach(f => console.log('  📄 ' + f));

console.log('\n======= MODEL FILES =======');
const modelFiles = fs.readdirSync('src/models/');
modelFiles.forEach(f => console.log('  📄 ' + f));

console.log('\n' + (allGood ? '✅ ALL ROUTES REGISTERED!' : '⚠️  SOME ROUTES MISSING!'));