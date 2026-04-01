const fs = require('fs');

let controller = fs.readFileSync('src/controllers/payment.controller.js', 'utf8');

// Fix receipt - must be max 40 chars
controller = controller.replace(
  "receipt: 'rcpt_' + req.user.id + '_' + Date.now(),",
  "receipt: ('rcpt_' + req.user.id + '_' + Date.now()).substring(0, 40),"
);

fs.writeFileSync('src/controllers/payment.controller.js', controller);
console.log('✅ Receipt length fixed! Restart backend: npm run dev');