const { Job, Application, User, CandidateProfile } = require('../models')
const { staff } = require('../utils/phase2')
const applicationController = require('./application.controller')
const base = (process.env.BACKEND_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
exports.screenCandidates = async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.jobId)
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' })
    if (!staff(req.user) && String(job.employerId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized' })
    const applications = await Application.findAll({ where: { jobId: job.id }, include: [{ model: User, as: 'candidate', attributes: ['id', 'email'], include: [{ model: CandidateProfile, as: 'candidateProfile', required: false }] }], order: [['createdAt', 'DESC']] })
    const data = applications.map(app => {
      const profile = app.candidate?.candidateProfile || {}
      const score = app.aiScore === null || app.aiScore === undefined || !app.screenedAt || ['pending', 'failed'].includes(app.aiStatus) ? null : Number(app.aiScore)
      const label = score === null ? 'Not screened' : score >= 80 ? 'Excellent Match' : score >= 60 ? 'Good Match' : score >= 40 ? 'Partial Match' : 'Low Match'
      let resumeUrl = app.resumeUrl || null
      if (resumeUrl && !/^https?:\/\//i.test(resumeUrl)) resumeUrl = `${base}/${resumeUrl.replace(/^\/+/, '')}`
      return { applicationId: app.id, applicationStatus: app.status, userId: app.candidateId, name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || app.candidate?.email || 'Candidate', email: app.candidate?.email, headline: profile.headline, currentLocation: profile.currentLocation, yearsOfExperience: Number(profile.yearsOfExperience || 0), resumeUrl, resumeFilename: app.resumeFilename, resumeUploaded: Boolean(resumeUrl), scores: { overall: score }, aiScore: score, aiStatus: app.aiStatus, screenedAt: app.screenedAt, matchedSkills: app.matchedSkills || [], missingSkills: app.missingSkills || [], aiSummary: app.aiSummary, screeningComment: app.aiSummary || 'Screening is pending. No score is available.', label, labelColor: score === null ? 'gray' : score >= 80 ? 'green' : score >= 60 ? 'blue' : score >= 40 ? 'yellow' : 'red', appliedAt: app.createdAt }
    }).sort((a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1))
    const scored = data.filter(x => x.aiScore !== null)
    return res.json({ success: true, data, summary: { total: data.length, unscored: data.length - scored.length, excellent: scored.filter(x => x.aiScore >= 80).length, good: scored.filter(x => x.aiScore >= 60 && x.aiScore < 80).length, partial: scored.filter(x => x.aiScore >= 40 && x.aiScore < 60).length, low: scored.filter(x => x.aiScore < 40).length, avgScore: scored.length ? Math.round(scored.reduce((s, x) => s + x.aiScore, 0) / scored.length) : null, jobTitle: job.title, jobSkills: job.requiredSkills || [], jobExpMin: job.minExperienceYears || 0 } })
  } catch (error) {
    console.error('Screening results failed:', error)
    return res.status(500).json({ success: false, message: 'Could not load screening results' })
  }
}
exports.updateApplicationStatus = applicationController.updateApplicationStatus
