const fs = require('fs');

let server = fs.readFileSync('src/server.js', 'utf8');

if (server.includes('/api/v1/employers')) {
  console.log('ℹ️  Already registered — might be under different name');
  // Show all app.use lines
  const lines = server.split('\n').filter(l => l.includes('app.use'));
  console.log('Current app.use lines:');
  lines.forEach(l => console.log(' ', l.trim()));
} else {
  // Add employers route — insert after /api/v1/candidates
  server = server.replace(
    "app.use('/api/v1/candidates'",
    "app.use('/api/v1/employers', require('./routes/employer.routes'));\napp.use('/api/v1/candidates'"
  );
  fs.writeFileSync('src/server.js', server);
  console.log('✅ /api/v1/employers registered in server.js');
  console.log('Restart backend: npm run dev');
}