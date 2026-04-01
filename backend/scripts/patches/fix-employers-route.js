// Patch: registers /api/v1/employers in server.js if missing
// Run from backend/: node scripts/patches/fix-employers-route.js
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../../src/server.js');
let server = fs.readFileSync(serverPath, 'utf8');

if (server.includes('/api/v1/employers')) {
  console.log('ℹ️  Already registered');
  const lines = server.split('\n').filter(l => l.includes('app.use'));
  console.log('Current app.use lines:');
  lines.forEach(l => console.log(' ', l.trim()));
} else {
  server = server.replace(
    "app.use('/api/v1/candidates'",
    "app.use('/api/v1/employers', require('./routes/employer.routes'));\napp.use('/api/v1/candidates'"
  );
  fs.writeFileSync(serverPath, server);
  console.log('✅ /api/v1/employers registered! Restart: npm run dev');
}
