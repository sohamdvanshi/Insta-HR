const fs = require('fs');

// ─────────────────────────────────────────────
// 1. AI Screening Controller
// ─────────────────────────────────────────────
const controller = `const { Job, Application, CandidateProfile, User } = require('../models/index');

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeSkill(skill) {
  return skill.toLowerCase().replace(/[^a-z0-9+#.]/g, '').trim();
}

function skillMatchScore(jobSkills = [], candidateSkills = []) {
  if (!jobSkills.length) return 50; // no skills listed → neutral
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
  // partial credit
  const ratio = candidateExp / jobExpMin;
  return Math.round(ratio * 80); // max 80 for under-experienced
}

function keywordScore(jobDescription = '', candidateProfile = {}) {
  if (!jobDescription) return 50;
  const text = (
    (candidateProfile.summary || '') + ' ' +
    (candidateProfile.headline || '') + ' ' +
    ((candidateProfile.skills || []).join(' ')) + ' ' +
    ((candidateProfile.experience || []).map(e => e.title + ' ' + e.company + ' ' + (e.description || '')).join(' '))
  ).toLowerCase();

  const desc = jobDescription.toLowerCase();
  // extract meaningful words (ignore stop words)
  const stopWords = new Set(['the','a','an','and','or','in','on','at','to','for','of','with','is','are','be','will','can','has','have','that','this','from','by','as','we','you','your','our','their']);
  const keywords = desc.split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));
  const uniqueKw = [...new Set(keywords)];
  if (!uniqueKw.length) return 50;

  const matched = uniqueKw.filter(kw => text.includes(kw));
  return Math.round((matched.length / uniqueKw.length) * 100);
}

function overallScore(skillPct, expPct, kwPct) {
  // Weighted: Skills 50%, Experience 30%, Keywords 20%
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

// ── Main Screening Endpoint ──────────────────────────────────────────

exports.screenCandidates = async (req, res) => {
  try {
    const { jobId } = req.params;

    // 1. Load job
    const job = await Job.findByPk(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    // 2. Only employer who owns the job (or admin) can screen
    if (req.user.role !== 'admin' && job.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to screen this job' });
    }

    // 3. Get all applicants for this job
    const applications = await Application.findAll({
      where: { jobId },
      include: [
        { model: User, as: 'candidate', attributes: ['id', 'name', 'email'] },
      ]
    });

    if (!applications.length) {
      return res.json({ success: true, data: [], message: 'No applications yet for this job' });
    }

    // 4. Get candidate profiles
    const userIds = applications.map(a => a.userId);
    const profiles = await CandidateProfile.findAll({ where: { userId: userIds } });
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.userId] = p; });

    // 5. Score each candidate
    const results = applications.map(app => {
      const profile = profileMap[app.userId] || {};
      const user = app.candidate || {};

      const candidateSkills = profile.skills || [];
      const candidateExp = profile.yearsOfExperience || 0;
      const jobExpMin = job.experienceMin || 0;
      const jobSkills = job.skills || [];

      const skillPct = skillMatchScore(jobSkills, candidateSkills);
      const expPct = experienceMatchScore(jobExpMin, candidateExp);
      const kwPct = keywordScore(job.description, profile.toJSON ? profile.toJSON() : profile);
      const overall = overallScore(skillPct, expPct, kwPct);

      const matchedSkills = getMatchedSkills(jobSkills, candidateSkills);
      const missingSkills = getMissingSkills(jobSkills, candidateSkills);

      return {
        applicationId: app.id,
        applicationStatus: app.status,
        userId: app.userId,
        name: user.name || 'Unknown',
        email: user.email || '',
        photoUrl: profile.photoUrl || null,
        headline: profile.headline || '',
        currentLocation: profile.currentLocation || '',
        yearsOfExperience: candidateExp,
        resumeUrl: profile.resumeUrl || null,
        scores: {
          skillMatch: skillPct,
          experienceMatch: expPct,
          keywordRelevance: kwPct,
          overall
        },
        matchedSkills,
        missingSkills,
        label: getLabel(overall),
        labelColor: getLabelColor(overall),
        appliedAt: app.createdAt
      };
    });

    // 6. Sort by overall score desc
    results.sort((a, b) => b.scores.overall - a.scores.overall);

    // 7. Stats summary
    const summary = {
      total: results.length,
      excellent: results.filter(r => r.scores.overall >= 80).length,
      good: results.filter(r => r.scores.overall >= 60 && r.scores.overall < 80).length,
      partial: results.filter(r => r.scores.overall >= 40 && r.scores.overall < 60).length,
      low: results.filter(r => r.scores.overall < 40).length,
      avgScore: results.length ? Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length) : 0,
      jobTitle: job.title,
      jobSkills: job.skills || [],
      jobExpMin: jobExpMin
    };

    res.json({ success: true, data: results, summary });
  } catch (error) {
    console.error('AI Screening error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Quick Shortlist: update application status ───────────────────────

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body; // shortlisted | rejected | interview | hired

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
console.log('✅ AI Screening controller created');

// ─────────────────────────────────────────────
// 2. AI Screening Routes
// ─────────────────────────────────────────────
const routes = `const express = require('express');
const router = express.Router();
const { screenCandidates, updateApplicationStatus } = require('../controllers/aiScreening.controller');
const { protect, authorize } = require('../middleware/auth');

// Screen all candidates who applied to a job
router.get('/screen/:jobId', protect, authorize('employer', 'admin'), screenCandidates);

// Update application status (shortlist/reject/interview)
router.patch('/application/:applicationId/status', protect, authorize('employer', 'admin'), updateApplicationStatus);

module.exports = router;
`;

fs.writeFileSync('src/routes/aiScreening.routes.js', routes);
console.log('✅ AI Screening routes created');

// ─────────────────────────────────────────────
// 3. Register route in server.js
// ─────────────────────────────────────────────
let server = fs.readFileSync('src/server.js', 'utf8');
if (!server.includes('aiScreening')) {
  server = server.replace(
    "app.use('/api/v1/jobs-actions'",
    "app.use('/api/v1/ai', require('./routes/aiScreening.routes'));\napp.use('/api/v1/jobs-actions'"
  );
  fs.writeFileSync('src/server.js', server);
  console.log('✅ Route registered in server.js');
} else {
  console.log('ℹ️  Route already registered');
}

// ─────────────────────────────────────────────
// 4. Ensure Application model has 'candidate' association
//    (alias used in controller: include User as 'candidate')
// ─────────────────────────────────────────────
let indexJs = fs.readFileSync('src/models/index.js', 'utf8');
if (!indexJs.includes("as: 'candidate'")) {
  // Add association after existing Application associations
  const assocLine = "Application.belongsTo(User";
  if (indexJs.includes(assocLine)) {
    indexJs = indexJs.replace(
      assocLine,
      "Application.belongsTo(User, { foreignKey: 'userId', as: 'candidate' });\n// original:\nApplication.belongsTo(User"
    );
  } else {
    // Append before module.exports
    indexJs = indexJs.replace(
      'module.exports',
      "Application.belongsTo(User, { foreignKey: 'userId', as: 'candidate' });\n\nmodule.exports"
    );
  }
  fs.writeFileSync('src/models/index.js', indexJs);
  console.log('✅ Application->User (as candidate) association added');
} else {
  console.log('ℹ️  Association already exists');
}

console.log('\n✅ Backend AI Screening DONE. Restart backend: npm run dev');