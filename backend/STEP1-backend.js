const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// FILE 1: src/controllers/aiScreening.controller.js
// ─────────────────────────────────────────────────────────────
const controller = `const { Job, Application, CandidateProfile, User } = require('../models/index');

function normalizeSkill(skill) {
  return skill.toLowerCase().replace(/[^a-z0-9+#.]/g, '').trim();
}

function skillMatchScore(jobSkills = [], candidateSkills = []) {
  if (!jobSkills.length) return 50;
  const normJob = jobSkills.map(normalizeSkill);
  const normCand = candidateSkills.map(normalizeSkill);
  const matched = normJob.filter(s => normCand.includes(s));
  return Math.round((matched.length / normJob.length) * 100);
}

function getMatchedSkills(jobSkills = [], candidateSkills = []) {
  const normJob = jobSkills.map(normalizeSkill);
  const normCand = candidateSkills.map(normalizeSkill);
  return jobSkills.filter((s, i) => normCand.includes(normJob[i]));
}

function getMissingSkills(jobSkills = [], candidateSkills = []) {
  const normJob = jobSkills.map(normalizeSkill);
  const normCand = candidateSkills.map(normalizeSkill);
  return jobSkills.filter((s, i) => !normCand.includes(normJob[i]));
}

function experienceMatchScore(jobExpMin = 0, candidateExp = 0) {
  if (jobExpMin === 0) return 100;
  if (candidateExp >= jobExpMin) return 100;
  if (candidateExp === 0) return 10;
  return Math.round((candidateExp / jobExpMin) * 80);
}

function keywordScore(jobDescription = '', candidateProfile = {}) {
  if (!jobDescription) return 50;
  const text = (
    (candidateProfile.summary || '') + ' ' +
    (candidateProfile.headline || '') + ' ' +
    ((candidateProfile.skills || []).join(' ')) + ' ' +
    ((candidateProfile.experience || []).map(e => (e.title || '') + ' ' + (e.company || '') + ' ' + (e.description || '')).join(' '))
  ).toLowerCase();

  const stopWords = new Set(['the','a','an','and','or','in','on','at','to','for','of','with','is','are','be','will','can','has','have','that','this','from','by','as','we','you','your','our','their']);
  const keywords = jobDescription.toLowerCase().split(/\\W+/).filter(w => w.length > 3 && !stopWords.has(w));
  const uniqueKw = [...new Set(keywords)];
  if (!uniqueKw.length) return 50;
  const matched = uniqueKw.filter(kw => text.includes(kw));
  return Math.round((matched.length / uniqueKw.length) * 100);
}

function overallScore(skillPct, expPct, kwPct) {
  return Math.round(skillPct * 0.5 + expPct * 0.3 + kwPct * 0.2);
}

function getLabel(score) {
  if (score >= 80) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Partial Match';
  return 'Low Match';
}

function getLabelColor(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'blue';
  if (score >= 40) return 'yellow';
  return 'red';
}

exports.screenCandidates = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findByPk(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    if (req.user.role !== 'admin' && job.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const applications = await Application.findAll({
      where: { jobId },
      include: [{ model: User, as: 'candidate', attributes: ['id', 'name', 'email'] }]
    });

    if (!applications.length) {
      return res.json({ success: true, data: [], message: 'No applications yet', summary: {
        total: 0, excellent: 0, good: 0, partial: 0, low: 0, avgScore: 0,
        jobTitle: job.title, jobSkills: job.skills || [], jobExpMin: job.experienceMin || 0
      }});
    }

    const userIds = applications.map(a => a.userId);
    const profiles = await CandidateProfile.findAll({ where: { userId: userIds } });
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.userId] = p; });

    const jobExpMin = job.experienceMin || 0;
    const jobSkills = job.skills || [];

    const results = applications.map(app => {
      const profile = profileMap[app.userId] || {};
      const user = app.candidate || {};
      const profileData = profile.toJSON ? profile.toJSON() : profile;

      const candidateSkills = profileData.skills || [];
      const candidateExp = profileData.yearsOfExperience || 0;

      const skillPct = skillMatchScore(jobSkills, candidateSkills);
      const expPct = experienceMatchScore(jobExpMin, candidateExp);
      const kwPct = keywordScore(job.description, profileData);
      const overall = overallScore(skillPct, expPct, kwPct);

      return {
        applicationId: app.id,
        applicationStatus: app.status || 'pending',
        userId: app.userId,
        name: user.name || 'Unknown',
        email: user.email || '',
        photoUrl: profileData.photoUrl || null,
        headline: profileData.headline || '',
        currentLocation: profileData.currentLocation || '',
        yearsOfExperience: candidateExp,
        resumeUrl: profileData.resumeUrl || null,
        scores: { skillMatch: skillPct, experienceMatch: expPct, keywordRelevance: kwPct, overall },
        matchedSkills: getMatchedSkills(jobSkills, candidateSkills),
        missingSkills: getMissingSkills(jobSkills, candidateSkills),
        label: getLabel(overall),
        labelColor: getLabelColor(overall),
        appliedAt: app.createdAt
      };
    });

    results.sort((a, b) => b.scores.overall - a.scores.overall);

    const summary = {
      total: results.length,
      excellent: results.filter(r => r.scores.overall >= 80).length,
      good: results.filter(r => r.scores.overall >= 60 && r.scores.overall < 80).length,
      partial: results.filter(r => r.scores.overall >= 40 && r.scores.overall < 60).length,
      low: results.filter(r => r.scores.overall < 40).length,
      avgScore: Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length),
      jobTitle: job.title,
      jobSkills,
      jobExpMin
    };

    res.json({ success: true, data: results, summary });
  } catch (error) {
    console.error('AI Screening error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;
    const app = await Application.findByPk(applicationId);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    await app.update({ status });
    res.json({ success: true, message: 'Status updated', data: app });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
`;

fs.writeFileSync('src/controllers/aiScreening.controller.js', controller);
console.log('✅ FILE 1 created: src/controllers/aiScreening.controller.js');

// ─────────────────────────────────────────────────────────────
// FILE 2: src/routes/aiScreening.routes.js
// ─────────────────────────────────────────────────────────────
const routes = `const express = require('express');
const router = express.Router();
const { screenCandidates, updateApplicationStatus } = require('../controllers/aiScreening.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/screen/:jobId', protect, authorize('employer', 'admin'), screenCandidates);
router.patch('/application/:applicationId/status', protect, authorize('employer', 'admin'), updateApplicationStatus);

module.exports = router;
`;

fs.writeFileSync('src/routes/aiScreening.routes.js', routes);
console.log('✅ FILE 2 created: src/routes/aiScreening.routes.js');

// ─────────────────────────────────────────────────────────────
// FILE 3: Register route in server.js
// ─────────────────────────────────────────────────────────────
let server = fs.readFileSync('src/server.js', 'utf8');
if (!server.includes('aiScreening')) {
  // Add before jobs-actions line, or before module.exports, or just append routes
  if (server.includes("jobs-actions")) {
    server = server.replace(
      "app.use('/api/v1/jobs-actions'",
      "app.use('/api/v1/ai', require('./routes/aiScreening.routes'));\napp.use('/api/v1/jobs-actions'"
    );
  } else if (server.includes("app.use('/api/v1/payments'")) {
    server = server.replace(
      "app.use('/api/v1/payments'",
      "app.use('/api/v1/ai', require('./routes/aiScreening.routes'));\napp.use('/api/v1/payments'"
    );
  } else {
    // append before last line
    server = server.replace(
      /module\.exports\s*=\s*app/,
      "app.use('/api/v1/ai', require('./routes/aiScreening.routes'));\n\nmodule.exports = app"
    );
  }
  fs.writeFileSync('src/server.js', server);
  console.log('✅ FILE 3 updated: src/server.js — /api/v1/ai route registered');
} else {
  console.log('ℹ️  server.js already has /api/v1/ai route');
}

// ─────────────────────────────────────────────────────────────
// FILE 4: Add Application -> User association in models/index.js
// ─────────────────────────────────────────────────────────────
let indexJs = fs.readFileSync('src/models/index.js', 'utf8');
if (!indexJs.includes("as: 'candidate'")) {
  indexJs = indexJs.replace(
    /module\.exports/,
    "// AI Screening association\ntry { Application.belongsTo(User, { foreignKey: 'userId', as: 'candidate' }); } catch(e) {}\n\nmodule.exports"
  );
  fs.writeFileSync('src/models/index.js', indexJs);
  console.log('✅ FILE 4 updated: src/models/index.js — candidate association added');
} else {
  console.log('ℹ️  models/index.js already has candidate association');
}

console.log('\n========================================');
console.log('✅ ALL BACKEND FILES DONE!');
console.log('Now restart backend: npm run dev');
console.log('========================================');