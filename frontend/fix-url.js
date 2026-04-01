const fs = require('fs');

const content = fs.readFileSync('src/app/ai-screening/page.tsx', 'utf8');
const fixed = content.replace(
  'http://localhost:5000/api/v1/jobs/employer/mine',
  'http://localhost:5000/api/v1/jobs/my'
);
fs.writeFileSync('src/app/ai-screening/page.tsx', fixed);
console.log('✅ Fixed! URL changed from /employer/mine to /my');