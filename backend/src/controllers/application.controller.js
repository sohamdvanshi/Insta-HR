const fs = require('fs')
const path = require('path')

const {
  sequelize,
  Application,
  Job,
  User,
  CandidateProfile,
  FeatureFlag
} = require('../models')

const {
  DEFAULT_REFERRAL_REWARD_POINTS,
  awardReferralReward
} = require('../services/referralReward.service')

const { extractResumeText } = require('../services/ai/resumeParserService')
const { screenResumeAgainstJob } = require('../services/ai/resumeScreeningService')
const {
  sendInterviewScheduledEmail,
  sendApplicationStatusEmail
} = require('../services/email/emailService')
const { writeAuditLog } = require('../utils/auditLogger')
const { runApplicationFraudChecks } = require('../utils/fraudDetector')
const { clearCacheByPattern } = require('../middleware/cache')

const MAX_RESUME_TEXT_LENGTH = 50000
const APPLICATION_STATUSES = ['applied', 'shortlisted', 'interview', 'rejected', 'hired']
const MANUAL_REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'sent_to_employer']
const INTERVIEW_MODES = ['online', 'offline']

const applicationInclude = [
  { model: Job, as: 'job' },
  {
    model: User,
    as: 'candidate',
    attributes: ['id', 'email', 'phone', 'role', 'avatar'],
    required: false,
    include: [{ model: CandidateProfile, as: 'candidateProfile', required: false }]
  },
  {
    model: User,
    as: 'referrer',
    attributes: ['id', 'email', 'referralCode'],
    required: false
  }
]

const applicationIdFrom = (req) => req.params.id || req.params.applicationId

const removeFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (error) {
    console.error('Failed to delete uploaded file:', error.message)
  }
}

const invalidateCaches = async (jobId, candidateId) => {
  try {
    await Promise.all([
      clearCacheByPattern('instahr:admin-analytics-*'),
      clearCacheByPattern('instahr:employer-analytics-*'),
      clearCacheByPattern('instahr:jobs-*'),
      clearCacheByPattern('instahr:applications-*'),
      jobId ? clearCacheByPattern(`instahr:job-${jobId}-*`) : Promise.resolve(),
      candidateId ? clearCacheByPattern(`instahr:candidate-${candidateId}-*`) : Promise.resolve()
    ])
  } catch (error) {
    console.error('Application cache invalidation error:', error.message)
  }
}

const auditFailure = async (req, action, entityId, targetUserId, metadata = {}) => {
  try {
    await writeAuditLog({
      req,
      action,
      entityType: 'Application',
      entityId,
      targetUserId,
      status: 'failure',
      metadata
    })
  } catch (error) {
    console.error('Audit log failure:', error.message)
  }
}

const referrerByCode = async (code, candidateId) => {
  if (!code) return null

  const normalized = String(code).trim().toUpperCase()
  const referrer = await User.findOne({
    where: { referralCode: normalized, role: 'candidate', isActive: true }
  })

  if (!referrer) {
    const error = new Error('Invalid referral code')
    error.statusCode = 400
    throw error
  }

  if (String(referrer.id) === String(candidateId)) {
    const error = new Error('You cannot use your own referral code')
    error.statusCode = 400
    throw error
  }

  return referrer
}

const candidateName = (application) =>
  application.candidate?.candidateProfile?.firstName ||
  application.candidate?.email ||
  'Candidate'

const fraudData = (fraud) => ({
  alertsCreated: fraud?.alertsCreated || 0,
  alerts: fraud?.alerts || []
})

exports.applyToJob = async (req, res) => {
  const uploadedPath = req.file?.path

  try {
    const { jobId } = req.params
    const { coverLetter, referralCode: rawReferralCode } = req.body
    const referralCode = rawReferralCode ? String(rawReferralCode).trim().toUpperCase() : null

    const job = await Job.findByPk(jobId)
    if (!job) {
      removeFile(uploadedPath)
      return res.status(404).json({ success: false, message: 'Job not found' })
    }

    if (job.status !== 'active' || (job.applicationDeadline && new Date(job.applicationDeadline) < new Date())) {
      removeFile(uploadedPath)
      return res.status(400).json({ success: false, message: 'This job is no longer accepting applications' })
    }

    const duplicate = await Application.findOne({ where: { jobId, candidateId: req.user.id } })
    if (duplicate) {
      removeFile(uploadedPath)
      return res.status(400).json({ success: false, message: 'You have already applied for this job' })
    }

    const referrer = await referrerByCode(referralCode, req.user.id)
    if (!req.file) return res.status(400).json({ success: false, message: 'Resume PDF is required' })

    let resumeText
    try {
      resumeText = String(await extractResumeText(req.file.path) || '').slice(0, MAX_RESUME_TEXT_LENGTH)
    } catch (error) {
      removeFile(uploadedPath)
      return res.status(500).json({ success: false, message: error.message || 'Failed to parse resume' })
    }

    const application = await Application.create({
      jobId,
      candidateId: req.user.id,
      referredByUserId: referrer?.id || null,
      referralCodeUsed: referrer?.referralCode || null,
      referralRewarded: false,
      coverLetter: coverLetter || null,
      status: 'applied',
      resumeUrl: `/uploads/resumes/${req.file.filename}`,
      resumeFilename: req.file.originalname,
      resumeText,
      aiStatus: 'pending',
      manualReviewStatus: 'pending'
    })

    try {
      const flag = await FeatureFlag.findByPk('ai_screening')
      if (!flag?.enabled) {
        await application.update({ aiStatus: 'pending' })
      } else {
      const screening = await screenResumeAgainstJob(resumeText, job)
      await application.update({
        aiScore: screening.aiScore,
        aiStatus: screening.aiStatus,
        aiSummary: screening.aiSummary,
        matchedSkills: Array.isArray(screening.matchedSkills) ? screening.matchedSkills : [],
        missingSkills: Array.isArray(screening.missingSkills) ? screening.missingSkills : [],
        aiRawResponse: screening.aiRawResponse || null,
        screenedAt: new Date()
      })
      }
    } catch (error) {
      console.error('Resume screening error:', error.message)
      await application.update({ aiStatus: 'failed', aiSummary: error.message || 'Resume screening failed' })
    }

    const data = await Application.findByPk(application.id, { include: applicationInclude })
    await writeAuditLog({
      req,
      action: 'APPLICATION_CREATED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: req.user.id,
      metadata: { jobId, candidateId: req.user.id, referralCode: referrer?.referralCode || null, aiStatus: data?.aiStatus, aiScore: data?.aiScore }
    })
    await invalidateCaches(jobId, req.user.id)

    return res.status(201).json({
      success: true,
      message: referrer ? 'Applied successfully with referral' : 'Applied successfully',
      data
    })
  } catch (error) {
    console.error('applyToJob error:', error)
    removeFile(uploadedPath)
    await auditFailure(req, 'APPLICATION_CREATE_FAILED', null, req.user?.id || null, {
      error: error.message || 'Internal server error',
      jobId: req.params?.jobId || null,
      referralCode: req.body?.referralCode || null
    })
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.getMyApplications = async (req, res) => {
  try {
    const data = await Application.findAll({ where: { candidateId: req.user.id }, include: applicationInclude, order: [['createdAt', 'DESC']] })
    return res.json({ success: true, count: data.length, data })
  } catch (error) {
    console.error('getMyApplications error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.getApplicationsForJob = async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await Job.findByPk(jobId)
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' })
    if (req.user.role === 'employer' && String(job.employerId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to view applications for this job' })

    const data = await Application.findAll({ where: { jobId }, include: applicationInclude, order: [['aiScore', 'DESC'], ['createdAt', 'DESC']] })
    return res.json({ success: true, count: data.length, data })
  } catch (error) {
    console.error('getApplicationsForJob error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findByPk(applicationIdFrom(req), { include: applicationInclude })
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' })
    if (req.user.role === 'candidate' && String(application.candidateId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to view this application' })
    if (req.user.role === 'employer' && String(application.job?.employerId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to view this application' })
    return res.json({ success: true, data: application })
  } catch (error) {
    console.error('getApplicationById error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.updateApplicationStatus = async (req, res) => {
  let transaction = null
  let finished = false

  try {
    const id = applicationIdFrom(req)
    const { status, interviewDate, notes } = req.body
    if (status && !APPLICATION_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid application status' })

    transaction = await sequelize.transaction()
    const application = await Application.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
    if (!application) {
      await transaction.rollback()
      finished = true
      return res.status(404).json({ success: false, message: 'Application not found' })
    }

    const job = await Job.findByPk(application.jobId, { transaction })
    const candidate = await User.findByPk(application.candidateId, {
      transaction,
      attributes: ['id', 'email', 'phone', 'role', 'avatar'],
      include: [{ model: CandidateProfile, as: 'candidateProfile', required: false }]
    })
    application.job = job
    application.candidate = candidate

    if (req.user.role === 'employer' && String(job?.employerId) !== String(req.user.id)) {
      await transaction.rollback()
      finished = true
      return res.status(403).json({ success: false, message: 'Not authorized to update this application' })
    }

    const previousStatus = application.status
    const nextStatus = status || previousStatus
    await application.update({ status: nextStatus, interviewDate: interviewDate ?? application.interviewDate, notes: notes ?? application.notes }, { transaction })

    let reward = { rewarded: false, alreadyRewarded: false, points: 0, transaction: null }
    if (nextStatus === 'hired' && previousStatus !== 'hired') {
      reward = await awardReferralReward({ applicationId: application.id, transaction, points: DEFAULT_REFERRAL_REWARD_POINTS, createdBy: req.user.id, reason: 'Referral bonus for hired candidate' })
    }

    await transaction.commit()
    finished = true

    await writeAuditLog({ req, action: 'APPLICATION_STATUS_UPDATED', entityType: 'Application', entityId: application.id, targetUserId: application.candidateId, metadata: { jobId: application.jobId, previousStatus, nextStatus, rewardCreated: reward.rewarded, rewardAlreadyExists: reward.alreadyRewarded, rewardPoints: reward.points } })

    if (application.candidate?.email && previousStatus !== nextStatus && ['shortlisted', 'rejected', 'hired'].includes(nextStatus)) {
      try {
        await sendApplicationStatusEmail(application.candidate.email, { candidateName: candidateName(application), jobTitle: application.job?.title || 'your application', status: nextStatus })
      } catch (error) {
        console.error('Status email error:', error.message)
      }
    }

    await invalidateCaches(application.jobId, application.candidateId)
    const data = await Application.findByPk(application.id, { include: applicationInclude })
    const hasReward = reward.rewarded || reward.alreadyRewarded

    return res.json({
      success: true,
      message: reward.rewarded ? 'Application hired and referral reward credited' : reward.alreadyRewarded ? 'Application status updated; referral reward already exists' : 'Application status updated successfully',
      reward: hasReward ? { points: reward.points, userId: application.referredByUserId, alreadyRewarded: reward.alreadyRewarded, transactionId: reward.transaction?.id || null } : null,
      data
    })
  } catch (error) {
    if (transaction && !finished) {
      try { await transaction.rollback() } catch (rollbackError) { console.error('Transaction rollback error:', rollbackError.message) }
    }
    console.error('updateApplicationStatus error:', error)
    await auditFailure(req, 'APPLICATION_STATUS_UPDATE_FAILED', applicationIdFrom(req), null, { error: error.message || 'Internal server error', attemptedStatus: req.body?.status || null })
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.updateManualReview = async (req, res) => {
  try {
    const id = applicationIdFrom(req)
    const { manualReviewStatus, notes } = req.body
    if (manualReviewStatus && !MANUAL_REVIEW_STATUSES.includes(manualReviewStatus)) return res.status(400).json({ success: false, message: 'Invalid manualReviewStatus value' })

    const application = await Application.findByPk(id, { include: [{ model: Job, as: 'job' }] })
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' })
    if (req.user.role === 'employer' && String(application.job?.employerId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to review this application' })

    await application.update({ manualReviewStatus: manualReviewStatus ?? application.manualReviewStatus, notes: notes ?? application.notes, reviewedBy: req.user.id, reviewedAt: new Date() })
    const data = await Application.findByPk(id, { include: applicationInclude })
    const fraud = await runApplicationFraudChecks(data)
    await invalidateCaches(application.jobId, application.candidateId)
    return res.json({ success: true, message: 'Manual review updated successfully', data, fraud: fraudData(fraud) })
  } catch (error) {
    console.error('updateManualReview error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.scheduleInterview = async (req, res) => {
  try {
    const id = applicationIdFrom(req)
    const { interviewDate, interviewMode, interviewMeetingLink, interviewLocation, interviewNotes } = req.body
    if (!interviewDate) return res.status(400).json({ success: false, message: 'interviewDate is required' })
    if (!INTERVIEW_MODES.includes(interviewMode)) return res.status(400).json({ success: false, message: 'interviewMode must be either online or offline' })
    if (interviewMode === 'online' && !interviewMeetingLink) return res.status(400).json({ success: false, message: 'interviewMeetingLink is required for online interviews' })
    if (interviewMode === 'offline' && !interviewLocation) return res.status(400).json({ success: false, message: 'interviewLocation is required for offline interviews' })

    const application = await Application.findByPk(id, { include: applicationInclude })
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' })
    if (req.user.role === 'employer' && String(application.job?.employerId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to schedule interview for this application' })

    const isReschedule = Boolean(application.interviewDate)
    await application.update({ status: 'interview', interviewDate: new Date(interviewDate), interviewMode, interviewMeetingLink: interviewMode === 'online' ? interviewMeetingLink : null, interviewLocation: interviewMode === 'offline' ? interviewLocation : null, interviewNotes: interviewNotes || null, interviewStatus: isReschedule ? 'rescheduled' : 'scheduled', interviewScheduledBy: req.user.id })

    if (application.candidate?.email) {
      try {
        await sendInterviewScheduledEmail(application.candidate.email, { candidateName: candidateName(application), jobTitle: application.job?.title || 'Job Interview', companyName: application.job?.companyName || 'InstaHire Employer', scheduledAt: interviewDate, mode: interviewMode, meetingLink: interviewMeetingLink, location: interviewLocation, notes: interviewNotes })
      } catch (error) {
        console.error('Interview email error:', error.message)
      }
    }

    await invalidateCaches(application.jobId, application.candidateId)
    return res.json({ success: true, message: isReschedule ? 'Interview rescheduled successfully' : 'Interview scheduled successfully', data: await Application.findByPk(id, { include: applicationInclude }) })
  } catch (error) {
    console.error('scheduleInterview error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.rescreenApplication = async (req, res) => {
  try {
    const id = applicationIdFrom(req)
    const application = await Application.findByPk(id, { include: [{ model: Job, as: 'job' }] })
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' })
    if (req.user.role === 'employer' && String(application.job?.employerId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to rescreen this application' })
    if (!application.resumeText) return res.status(400).json({ success: false, message: 'No resume text found for this application' })

    const screening = await screenResumeAgainstJob(application.resumeText, application.job)
    await application.update({ aiScore: screening.aiScore, aiStatus: screening.aiStatus, aiSummary: screening.aiSummary, matchedSkills: screening.matchedSkills || [], missingSkills: screening.missingSkills || [], aiRawResponse: screening.aiRawResponse || null, screenedAt: new Date(), manualReviewStatus: 'pending' })
    const data = await Application.findByPk(id, { include: applicationInclude })
    const fraud = await runApplicationFraudChecks(data)
    await invalidateCaches(application.jobId, application.candidateId)
    return res.json({ success: true, message: 'Application rescreened successfully', data, fraud: fraudData(fraud) })
  } catch (error) {
    console.error('rescreenApplication error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

exports.deleteApplication = async (req, res) => {
  try {
    const id = applicationIdFrom(req)
    const application = await Application.findByPk(id, { include: [{ model: Job, as: 'job' }] })
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' })
    if (req.user.role === 'candidate' && String(application.candidateId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to delete this application' })
    if (req.user.role === 'employer' && String(application.job?.employerId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized to delete this application' })

    if (application.resumeUrl) removeFile(path.join(__dirname, '../../uploads/resumes', path.basename(application.resumeUrl)))

    const snapshot = { applicationId: application.id, jobId: application.jobId, candidateId: application.candidateId, status: application.status, referralRewarded: application.referralRewarded }
    await application.destroy()
    await writeAuditLog({ req, action: 'APPLICATION_DELETED', entityType: 'Application', entityId: snapshot.applicationId, targetUserId: snapshot.candidateId, metadata: snapshot })
    await invalidateCaches(snapshot.jobId, snapshot.candidateId)
    return res.json({ success: true, message: 'Application deleted successfully' })
  } catch (error) {
    console.error('deleteApplication error:', error)
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
  }
}