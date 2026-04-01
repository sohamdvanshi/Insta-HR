const fs = require('fs');

let controller = fs.readFileSync('src/controllers/aiScreening.controller.js', 'utf8');

// The issue: job.userId might be stored as a different field name
// Let's remove the strict ownership check and just verify employer role
// Also add logging to debug

const oldCheck = `    if (req.user.role !== 'admin' && job.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }`;

const newCheck = `    // Authorization: admin can screen any job, employer can screen their own
    // Check both userId and employerId fields (different setups use different names)
    const jobOwnerId = job.userId || job.employerId || job.createdBy;
    console.log('Auth check - job owner:', jobOwnerId, '| req.user.id:', req.user.id, '| role:', req.user.role);
    if (req.user.role !== 'admin' && String(jobOwnerId) !== String(req.user.id)) {
      console.log('Auth FAILED - job does not belong to this employer');
      return res.status(403).json({ success: false, message: 'Not authorized - this job does not belong to you' });
    }`;

if (controller.includes("job.userId !== req.user.id")) {
  controller = controller.replace(oldCheck, newCheck);
  fs.writeFileSync('src/controllers/aiScreening.controller.js', controller);
  console.log('✅ Fixed auth check in aiScreening.controller.js');
} else {
  console.log('Pattern not found exactly — rewriting auth section...');
  // More aggressive replace
  controller = controller.replace(
    /if \(req\.user\.role !== 'admin'[\s\S]*?}\s*\n/,
    `    const jobOwnerId = job.userId || job.employerId || job.createdBy;
    console.log('Auth check - job owner:', jobOwnerId, '| req.user.id:', req.user.id, '| role:', req.user.role);
    if (req.user.role !== 'admin' && String(jobOwnerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized - this job does not belong to you' });
    }\n`
  );
  fs.writeFileSync('src/controllers/aiScreening.controller.js', controller);
  console.log('✅ Auth section rewritten');
}

// Also check what field the Job model actually uses
if (fs.existsSync('src/models/Job.js')) {
  const jobModel = fs.readFileSync('src/models/Job.js', 'utf8');
  const hasUserId = jobModel.includes('userId');
  const hasEmployerId = jobModel.includes('employerId');
  const hasCreatedBy = jobModel.includes('createdBy');
  console.log('\nJob model fields check:');
  console.log('  userId:', hasUserId);
  console.log('  employerId:', hasEmployerId);
  console.log('  createdBy:', hasCreatedBy);
  
  // Show relevant lines
  const lines = jobModel.split('\n').filter(l => l.includes('userId') || l.includes('employerId') || l.includes('createdBy'));
  console.log('  Relevant lines:', lines);
}

console.log('\n✅ Done! Restart backend: npm run dev');
console.log('Then click a job on /ai-screening to test');