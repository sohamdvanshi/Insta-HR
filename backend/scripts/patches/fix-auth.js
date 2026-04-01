// Patch: fixes auth ownership check in aiScreening.controller.js
// Run from backend/: node scripts/patches/fix-auth.js
const fs = require('fs');
const path = require('path');

let controller = fs.readFileSync(path.join(__dirname,'../../src/controllers/aiScreening.controller.js'), 'utf8');

const newCheck = `    const jobOwnerId = job.userId || job.employerId || job.createdBy;
    console.log('Auth check - job owner:', jobOwnerId, '| req.user.id:', req.user.id, '| role:', req.user.role);
    if (req.user.role !== 'admin' && String(jobOwnerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized - this job does not belong to you' });
    }`;

controller = controller.replace(
  /if \(req\.user\.role !== 'admin'[\s\S]*?}\s*\n/,
  newCheck + '\n'
);
fs.writeFileSync(path.join(__dirname,'../../src/controllers/aiScreening.controller.js'), controller);
console.log('✅ Auth check fixed! Restart: npm run dev');
