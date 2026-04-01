const fs = require('fs');
let content = fs.readFileSync('src/app/subscription/page.tsx', 'utf8');
content = content.replace(/â‚¹/g, '₹');
content = content.replace(/âœ"/g, '✓');
fs.writeFileSync('src/app/subscription/page.tsx', content);
console.log('Fixed!');