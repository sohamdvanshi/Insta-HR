const fs = require('fs');

// ─── 1. SAVED JOBS MODEL ───
const savedJobModel = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SavedJob = sequelize.define('SavedJob', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  jobId: { type: DataTypes.INTEGER, allowNull: false },
}, { 
  tableName: 'SavedJobs', 
  timestamps: true,
  indexes: [{ unique: true, fields: ['userId', 'jobId'] }]
});

module.exports = SavedJob;
`;
fs.writeFileSync('src/models/SavedJob.js', savedJobModel);
console.log('✅ SavedJob model created');

// ─── 2. JOB ALERT MODEL ───
const jobAlertModel = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobAlert = sequelize.define('JobAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  keywords: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  industry: { type: DataTypes.STRING },
  jobType: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastSentAt: { type: DataTypes.DATE },
}, { tableName: 'JobAlerts', timestamps: true });

module.exports = JobAlert;
`;
fs.writeFileSync('src/models/JobAlert.js', jobAlertModel);
console.log('✅ JobAlert model created');

// ─── 3. SAVED JOBS CONTROLLER ───
const savedJobsController = `const { SavedJob, Job, User, JobAlert } = require('../models/index');
const nodemailer = require('nodemailer');

// ── SAVED JOBS ──

exports.saveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const existing = await SavedJob.findOne({ where: { userId: req.user.id, jobId } });
    if (existing) {
      await existing.destroy();
      return res.json({ success: true, saved: false, message: 'Job removed from saved' });
    }
    await SavedJob.create({ userId: req.user.id, jobId });
    res.json({ success: true, saved: true, message: 'Job saved!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSavedJobs = async (req, res) => {
  try {
    const saved = await SavedJob.findAll({
      where: { userId: req.user.id },
      include: [{ model: Job, as: 'job' }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkSaved = async (req, res) => {
  try {
    const { jobId } = req.params;
    const saved = await SavedJob.findOne({ where: { userId: req.user.id, jobId } });
    res.json({ success: true, saved: !!saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── JOB ALERTS ──

exports.createAlert = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const alert = await JobAlert.create({
      userId: req.user.id,
      email: req.body.email || user.email,
      keywords: req.body.keywords || '',
      location: req.body.location || '',
      industry: req.body.industry || '',
      jobType: req.body.jobType || '',
    });
    res.json({ success: true, data: alert, message: 'Job alert created!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await JobAlert.findAll({ 
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    await JobAlert.destroy({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ success: true, message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleAlert = async (req, res) => {
  try {
    const alert = await JobAlert.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await alert.update({ isActive: !alert.isActive });
    res.json({ success: true, isActive: alert.isActive, message: alert.isActive ? 'Alert enabled' : 'Alert paused' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── SEND JOB ALERT EMAILS (called when new job posted) ──
exports.sendJobAlertEmails = async (job) => {
  try {
    const alerts = await JobAlert.findAll({ where: { isActive: true } });
    if (!alerts.length) return;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    for (const alert of alerts) {
      // Check if job matches alert criteria
      const keywordMatch = !alert.keywords || 
        alert.keywords.split(',').some(k => 
          job.title?.toLowerCase().includes(k.trim().toLowerCase()) ||
          job.description?.toLowerCase().includes(k.trim().toLowerCase())
        );
      const locationMatch = !alert.location || 
        job.location?.toLowerCase().includes(alert.location.toLowerCase());
      const industryMatch = !alert.industry || job.industry === alert.industry;
      const typeMatch = !alert.jobType || job.jobType === alert.jobType;

      if (keywordMatch && locationMatch && industryMatch && typeMatch) {
        try {
          await transporter.sendMail({
            from: '"InstaHire Jobs" <' + process.env.SMTP_USER + '>',
            to: alert.email,
            subject: '🔔 New Job Match: ' + job.title + ' at ' + job.companyName,
            html: \`
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px;">
                <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:24px;">🔔 New Job Alert</h1>
                  <p style="color:#bfdbfe;margin:8px 0 0;">A job matching your preferences was just posted!</p>
                </div>
                <div style="background:white;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                  <h2 style="color:#1e40af;margin:0 0 8px;">\${job.title}</h2>
                  <p style="color:#6b7280;margin:0 0 16px;">🏢 \${job.companyName || 'Company'} &nbsp;•&nbsp; 📍 \${job.location || 'Remote'}</p>
                  
                  <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:6px;margin:16px 0;">
                    <p style="margin:0;color:#1e40af;font-size:14px;">
                      💼 \${job.jobType || 'Full-time'} &nbsp;•&nbsp; 
                      💰 \${job.salaryMin ? '₹' + job.salaryMin.toLocaleString() + ' - ₹' + job.salaryMax.toLocaleString() : 'Salary not disclosed'}
                    </p>
                  </div>

                  <p style="color:#374151;line-height:1.6;">\${(job.description || '').substring(0, 200)}...</p>

                  <a href="http://localhost:3000/jobs/\${job.id}" 
                     style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">
                    View & Apply Now →
                  </a>

                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
                  <p style="color:#9ca3af;font-size:12px;text-align:center;">
                    You're receiving this because you set up a job alert on InstaHire.<br>
                    <a href="http://localhost:3000/dashboard" style="color:#6b7280;">Manage your alerts</a>
                  </p>
                </div>
              </div>
            \`,
          });
          await alert.update({ lastSentAt: new Date() });
        } catch (emailErr) {
          console.error('Failed to send alert to', alert.email, emailErr.message);
        }
      }
    }
  } catch (err) {
    console.error('sendJobAlertEmails error:', err.message);
  }
};
`;
fs.writeFileSync('src/controllers/savedJobs.controller.js', savedJobsController);
console.log('✅ SavedJobs controller created');

// ─── 4. ROUTES ───
const routes = `const express = require('express');
const router = express.Router();
const savedJobsController = require('../controllers/savedJobs.controller');
const { protect, authorize } = require('../middleware/auth');

// Saved jobs
router.post('/save/:jobId', protect, authorize('candidate'), savedJobsController.saveJob);
router.get('/saved', protect, authorize('candidate'), savedJobsController.getSavedJobs);
router.get('/saved/check/:jobId', protect, authorize('candidate'), savedJobsController.checkSaved);

// Job alerts
router.post('/alerts', protect, authorize('candidate'), savedJobsController.createAlert);
router.get('/alerts', protect, authorize('candidate'), savedJobsController.getAlerts);
router.delete('/alerts/:id', protect, authorize('candidate'), savedJobsController.deleteAlert);
router.patch('/alerts/:id/toggle', protect, authorize('candidate'), savedJobsController.toggleAlert);

module.exports = router;
`;
fs.writeFileSync('src/routes/savedJobs.routes.js', routes);
console.log('✅ SavedJobs routes created');

// ─── 5. UPDATE index.js ───
let idx = fs.readFileSync('src/models/index.js', 'utf8');
if (!idx.includes('SavedJob')) {
  idx = idx.replace(
    "const Payment = require('./Payment');",
    "const Payment = require('./Payment');\nconst SavedJob = require('./SavedJob');\nconst JobAlert = require('./JobAlert');"
  );
  idx = idx.replace(
    'module.exports = {',
    'module.exports = {\n  SavedJob,\n  JobAlert,'
  );
  // Add association: SavedJob belongs to Job
  idx = idx.replace(
    'module.exports = {',
    `SavedJob.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });
Job.hasMany(SavedJob, { foreignKey: 'jobId' });

module.exports = {`
  );
  fs.writeFileSync('src/models/index.js', idx);
  console.log('✅ index.js updated with SavedJob + JobAlert');
} else {
  console.log('ℹ️  Already in index.js');
}

// ─── 6. REGISTER ROUTES in server.js ───
let server = fs.readFileSync('src/server.js', 'utf8');
if (!server.includes('savedJobs.routes')) {
  server = server.replace(
    "app.use('/api/v1/payments'",
    "app.use('/api/v1/jobs-actions', require('./routes/savedJobs.routes'));\napp.use('/api/v1/payments'"
  );
  fs.writeFileSync('src/server.js', server);
  console.log('✅ SavedJobs routes registered in server.js');
} else {
  console.log('ℹ️  Already registered');
}

// ─── 7. TRIGGER ALERTS WHEN JOB IS POSTED ───
let jobController = fs.readFileSync('src/controllers/job.controller.js', 'utf8');
if (!jobController.includes('sendJobAlertEmails')) {
  jobController = `const { sendJobAlertEmails } = require('./savedJobs.controller');\n` + jobController;
  // After job creation, send alerts
  jobController = jobController.replace(
    'res.status(201).json({ success: true, data: job });',
    `res.status(201).json({ success: true, data: job });
    // Send job alert emails in background
    sendJobAlertEmails(job).catch(console.error);`
  );
  fs.writeFileSync('src/controllers/job.controller.js', jobController);
  console.log('✅ Job alerts wired into job posting');
} else {
  console.log('ℹ️  Alerts already wired');
}

console.log('\n🎉 Backend done! Restart: npm run dev');