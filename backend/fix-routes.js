const fs = require('fs');

// ── STEP 1: Check what job routes file is named ──────────────────
let routeFile = '';
if (fs.existsSync('src/routes/job.routes.js')) routeFile = 'src/routes/job.routes.js';
else if (fs.existsSync('src/routes/jobs.routes.js')) routeFile = 'src/routes/jobs.routes.js';
else {
  // find it
  const files = fs.readdirSync('src/routes/');
  console.log('Routes folder contents:', files);
  process.exit(1);
}
console.log('Found route file:', routeFile);

let jobRoutes = fs.readFileSync(routeFile, 'utf8');
console.log('\n--- Current job routes ---\n', jobRoutes, '\n--------------------------\n');

// ── STEP 2: Check job controller ──────────────────────────────────
let controllerFile = '';
if (fs.existsSync('src/controllers/job.controller.js')) controllerFile = 'src/controllers/job.controller.js';
else if (fs.existsSync('src/controllers/jobs.controller.js')) controllerFile = 'src/controllers/jobs.controller.js';

let jobController = fs.readFileSync(controllerFile, 'utf8');
const hasGetMyJobs = jobController.includes('getMyJobs') || jobController.includes('employer/mine') || jobController.includes('myJobs');
console.log('Controller has getMyJobs:', hasGetMyJobs);

// ── STEP 3: Add getMyJobs to controller if missing ────────────────
if (!hasGetMyJobs) {
  const getMyJobsFn = `
// Get jobs posted by the logged-in employer
exports.getMyJobs = async (req, res) => {
  try {
    const { Job } = require('../models/index');
    const jobs = await Job.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
`;
  jobController += getMyJobsFn;
  fs.writeFileSync(controllerFile, jobController);
  console.log('✅ Added getMyJobs to controller');
} else {
  console.log('ℹ️  getMyJobs already in controller');
}

// ── STEP 4: Add route if missing ─────────────────────────────────
const hasRoute = jobRoutes.includes('employer/mine') || jobRoutes.includes('getMyJobs');
if (!hasRoute) {
  // Add before module.exports
  jobRoutes = jobRoutes.replace(
    'module.exports',
    `// Employer: get my posted jobs — MUST be before /:id
router.get('/employer/mine', protect, authorize('employer', 'admin'), jobController.getMyJobs);

module.exports`
  );
  
  // Make sure protect/authorize are imported
  if (!jobRoutes.includes('protect')) {
    jobRoutes = jobRoutes.replace(
      "const express = require('express');",
      "const express = require('express');\nconst { protect, authorize } = require('../middleware/auth');"
    );
  }
  
  // Make sure jobController is imported  
  if (!jobRoutes.includes('jobController') && !jobRoutes.includes('job.controller')) {
    jobRoutes = jobRoutes.replace(
      "const express = require('express');",
      "const express = require('express');\nconst jobController = require('../controllers/job.controller');"
    );
  }

  fs.writeFileSync(routeFile, jobRoutes);
  console.log('✅ Added /employer/mine route to', routeFile);
} else {
  console.log('ℹ️  Route already exists, checking placement...');
  
  // The route must be BEFORE /:id to avoid conflict
  // Re-read and rewrite to ensure correct order
  if (jobRoutes.includes("router.get('/:id'") && jobRoutes.indexOf('employer/mine') > jobRoutes.indexOf("router.get('/:id'")) {
    console.log('⚠️  employer/mine is AFTER /:id — fixing order...');
    // Remove existing employer/mine line
    jobRoutes = jobRoutes.replace(/router\.get\('\/employer\/mine'[^\n]+\n?/, '');
    // Add before /:id
    jobRoutes = jobRoutes.replace(
      "router.get('/:id'",
      "router.get('/employer/mine', protect, authorize('employer', 'admin'), jobController.getMyJobs);\nrouter.get('/:id'"
    );
    fs.writeFileSync(routeFile, jobRoutes);
    console.log('✅ Fixed route order');
  }
}

// ── STEP 5: Verify server.js has /api/v1/ai ──────────────────────
let server = fs.readFileSync('src/server.js', 'utf8');
if (!server.includes('/api/v1/ai')) {
  console.log('\n⚠️  /api/v1/ai not in server.js — adding now...');
  
  // Find a good place to insert
  const insertAfter = server.includes("'/api/v1/jobs-actions'")
    ? "app.use('/api/v1/jobs-actions'"
    : server.includes("'/api/v1/payments'")
    ? "app.use('/api/v1/payments'"
    : null;

  if (insertAfter) {
    server = server.replace(
      `app.use('${insertAfter.split("'")[1]}'`,
      `app.use('/api/v1/ai', require('./routes/aiScreening.routes'));\napp.use('${insertAfter.split("'")[1]}'`
    );
  } else {
    server = server.replace(
      /module\.exports\s*=\s*app/,
      "app.use('/api/v1/ai', require('./routes/aiScreening.routes'));\n\nmodule.exports = app"
    );
  }
  fs.writeFileSync('src/server.js', server);
  console.log('✅ Added /api/v1/ai to server.js');
} else {
  console.log('✅ /api/v1/ai already in server.js');
}

// ── STEP 6: Show final routes for confirmation ────────────────────
console.log('\n--- Final job routes ---');
console.log(fs.readFileSync(routeFile, 'utf8'));

console.log('\n========================================');
console.log('✅ ALL FIXES APPLIED!');
console.log('Now restart backend: npm run dev');
console.log('========================================');