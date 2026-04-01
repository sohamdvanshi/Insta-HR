const fs = require('fs');

let controller = fs.readFileSync('src/controllers/aiScreening.controller.js', 'utf8');

// Fix 1: Remove 'name' from User attributes - User only has email
controller = controller.replace(
  `include: [{ model: User, as: 'candidate', attributes: ['id', 'name', 'email'] }]`,
  `include: [{ model: User, as: 'candidate', attributes: ['id', 'email'] }]`
);

// Fix 2: Update where name is used - use email as display name fallback
controller = controller.replace(
  `name: user.name || 'Unknown',`,
  `name: user.email ? user.email.split('@')[0] : 'Unknown',`
);

fs.writeFileSync('src/controllers/aiScreening.controller.js', controller);
console.log('✅ Fixed! User name removed, using email prefix instead');
console.log('Restart backend: npm run dev');