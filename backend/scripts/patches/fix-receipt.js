// Patch: fixes Razorpay receipt length (max 40 chars)
// Run from backend/: node scripts/patches/fix-receipt.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/controllers/payment.controller.js');
let controller = fs.readFileSync(filePath, 'utf8');
controller = controller.replace(
  "receipt: 'rcpt_' + req.user.id + '_' + Date.now(),",
  "receipt: ('rcpt_' + req.user.id + '_' + Date.now()).substring(0, 40),"
);
fs.writeFileSync(filePath, controller);
console.log('✅ Receipt length fixed! Restart: npm run dev');
