const { SavedJob, Job, User, JobAlert } = require('../models/index');
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
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px;">
                <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:24px;">🔔 New Job Alert</h1>
                  <p style="color:#bfdbfe;margin:8px 0 0;">A job matching your preferences was just posted!</p>
                </div>
                <div style="background:white;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                  <h2 style="color:#1e40af;margin:0 0 8px;">${job.title}</h2>
                  <p style="color:#6b7280;margin:0 0 16px;">🏢 ${job.companyName || 'Company'} &nbsp;•&nbsp; 📍 ${job.location || 'Remote'}</p>
                  
                  <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:6px;margin:16px 0;">
                    <p style="margin:0;color:#1e40af;font-size:14px;">
                      💼 ${job.jobType || 'Full-time'} &nbsp;•&nbsp; 
                      💰 ${job.salaryMin ? '₹' + job.salaryMin.toLocaleString() + ' - ₹' + job.salaryMax.toLocaleString() : 'Salary not disclosed'}
                    </p>
                  </div>

                  <p style="color:#374151;line-height:1.6;">${(job.description || '').substring(0, 200)}...</p>

                  <a href="http://localhost:3000/jobs/${job.id}" 
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
            `,
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
