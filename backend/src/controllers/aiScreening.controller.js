const { Job, Application, CandidateProfile, User } = require('../models/index');

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
  const keywords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));
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

    // Authorization: admin can screen any job, employer can screen their own
    // Check both userId and employerId fields (different setups use different names)
    const jobOwnerId = job.userId || job.employerId || job.createdBy;
    console.log('Auth check - job owner:', jobOwnerId, '| req.user.id:', req.user.id, '| role:', req.user.role);
    if (req.user.role !== 'admin' && String(jobOwnerId) !== String(req.user.id)) {
      console.log('Auth FAILED - job does not belong to this employer');
      return res.status(403).json({ success: false, message: 'Not authorized - this job does not belong to you' });
    }

    const applications = await Application.findAll({
      where: { jobId },
      include: [{ model: User, as: 'candidate', attributes: ['id', 'email'] }]
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
        name: user.email ? user.email.split('@')[0] : 'Unknown',
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
