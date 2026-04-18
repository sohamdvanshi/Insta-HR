const fs = require('fs');
const path = require('path');
const { Application, Job, User, CandidateProfile } = require('../models');
const { extractResumeText } = require('../services/ai/resumeParserService');
const { screenResumeAgainstJob } = require('../services/ai/resumeScreeningService');
const {
  sendInterviewScheduledEmail,
  sendApplicationStatusEmail
} = require('../services/email/emailService');
const { writeAuditLog } = require('../utils/auditLogger');
const { runApplicationFraudChecks } = require('../utils/fraudDetector');
const { clearCacheByPattern } = require('../middleware/cache');

const invalidateApplicationRelatedCaches = async (jobId = null, candidateId = null) => {
  try {
    await Promise.all([
      clearCacheByPattern('instahr:admin-analytics-*'),
      clearCacheByPattern('instahr:employer-analytics-*'),
      clearCacheByPattern('instahr:jobs-*'),
      clearCacheByPattern('instahr:applications-*'),
      jobId ? clearCacheByPattern(`instahr:job-${jobId}-*`) : Promise.resolve(),
      candidateId ? clearCacheByPattern(`instahr:candidate-${candidateId}-*`) : Promise.resolve(),
    ]);
  } catch (error) {
    console.error('Application cache invalidation error:', error.message);
  }
};

exports.applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { coverLetter } = req.body;

    const job = await Job.findByPk(jobId);

    if (!job) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      await writeAuditLog({
        req,
        action: 'APPLICATION_CREATE_FAILED',
        entityType: 'Application',
        entityId: null,
        targetUserId: req.user?.id || null,
        status: 'failure',
        metadata: {
          reason: 'Job not found',
          jobId,
        },
      });

      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const existingApplication = await Application.findOne({
      where: {
        jobId,
        candidateId: req.user.id
      }
    });

    if (existingApplication) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      await writeAuditLog({
        req,
        action: 'APPLICATION_CREATE_FAILED',
        entityType: 'Application',
        entityId: existingApplication.id,
        targetUserId: req.user.id,
        status: 'failure',
        metadata: {
          reason: 'Duplicate application attempt',
          jobId,
          candidateId: req.user.id,
        },
      });

      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    if (!req.file) {
      await writeAuditLog({
        req,
        action: 'APPLICATION_CREATE_FAILED',
        entityType: 'Application',
        entityId: null,
        targetUserId: req.user.id,
        status: 'failure',
        metadata: {
          reason: 'Resume PDF is required',
          jobId,
        },
      });

      return res.status(400).json({
        success: false,
        message: 'Resume PDF is required'
      });
    }

    const resumeUrl = `/uploads/resumes/${req.file.filename}`;
    const resumeFilename = req.file.originalname;

    let resumeText = '';
    try {
      resumeText = await extractResumeText(req.file.path);
    } catch (parseError) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      await writeAuditLog({
        req,
        action: 'APPLICATION_RESUME_PARSE_FAILED',
        entityType: 'Application',
        entityId: null,
        targetUserId: req.user.id,
        status: 'failure',
        metadata: {
          reason: parseError.message || 'Failed to parse resume',
          jobId,
          resumeFilename,
        },
      });

      return res.status(500).json({
        success: false,
        message: parseError.message || 'Failed to parse resume'
      });
    }

    const application = await Application.create({
      jobId,
      candidateId: req.user.id,
      coverLetter: coverLetter || null,
      status: 'applied',
      resumeUrl,
      resumeFilename,
      resumeText,
      aiStatus: 'pending',
      manualReviewStatus: 'pending'
    });

    const screening = await screenResumeAgainstJob(resumeText, job);

    await application.update({
      aiScore: screening.aiScore,
      aiStatus: screening.aiStatus,
      aiSummary: screening.aiSummary,
      matchedSkills: screening.matchedSkills,
      missingSkills: screening.missingSkills,
      aiRawResponse: screening.aiRawResponse,
      screenedAt: new Date()
    });

    const refreshedApplication = await Application.findByPk(application.id);

    await writeAuditLog({
      req,
      action: 'APPLICATION_CREATED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: req.user.id,
      metadata: {
        jobId,
        candidateId: req.user.id,
        resumeFilename,
        aiStatus: refreshedApplication?.aiStatus,
        aiScore: refreshedApplication?.aiScore,
      },
    });

    await writeAuditLog({
      req,
      action: 'APPLICATION_AI_SCREENED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: req.user.id,
      metadata: {
        jobId,
        aiStatus: refreshedApplication?.aiStatus,
        aiScore: refreshedApplication?.aiScore,
        matchedSkillsCount: Array.isArray(refreshedApplication?.matchedSkills)
          ? refreshedApplication.matchedSkills.length
          : 0,
        missingSkillsCount: Array.isArray(refreshedApplication?.missingSkills)
          ? refreshedApplication.missingSkills.length
          : 0,
      },
    });

    let fraudCheckResult = { alertsCreated: 0, alerts: [] };

    if (refreshedApplication) {
      fraudCheckResult = await runApplicationFraudChecks(refreshedApplication);

      await writeAuditLog({
        req,
        action: 'APPLICATION_FRAUD_CHECK_COMPLETED',
        entityType: 'Application',
        entityId: refreshedApplication.id,
        targetUserId: refreshedApplication.candidateId,
        metadata: {
          jobId: refreshedApplication.jobId,
          alertsCreated: fraudCheckResult.alertsCreated,
          rules: fraudCheckResult.alerts.map((item) => item.ruleCode),
        },
      });
    }

    const updatedApplication = await Application.findByPk(application.id, {
      include: [
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    await invalidateApplicationRelatedCaches(application.jobId, application.candidateId);

    return res.status(201).json({
      success: true,
      message: 'Applied successfully and resume screened',
      data: updatedApplication,
      fraud: {
        alertsCreated: fraudCheckResult.alertsCreated,
        alerts: fraudCheckResult.alerts,
      }
    });
  } catch (error) {
    console.error('applyToJob error:', error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    await writeAuditLog({
      req,
      action: 'APPLICATION_CREATE_FAILED',
      entityType: 'Application',
      entityId: null,
      targetUserId: req.user?.id || null,
      status: 'failure',
      metadata: {
        error: error.message || 'Internal server error',
        jobId: req.params?.jobId || null,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const applications = await Application.findAll({
      where: {
        candidateId: req.user.id
      },
      include: [
        {
          model: Job,
          as: 'job'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    console.error('getMyApplications error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.getApplicationsForJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findByPk(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (req.user.role === 'employer' && job.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view applications for this job'
      });
    }

    const applications = await Application.findAll({
      where: { jobId },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile'
            }
          ]
        },
        {
          model: Job,
          as: 'job'
        }
      ],
      order: [
        ['aiScore', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    return res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    console.error('getApplicationsForJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile'
            }
          ]
        }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (req.user.role === 'candidate' && application.candidateId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this application'
      });
    }

    if (req.user.role === 'employer' && application.job?.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this application'
      });
    }

    return res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('getApplicationById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, interviewDate, notes } = req.body;

    const allowedStatuses = ['applied', 'shortlisted', 'interview', 'rejected', 'hired'];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application status'
      });
    }

    const application = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile'
            }
          ]
        }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (req.user.role === 'employer' && application.job?.employerId !== req.user.id) {
      await writeAuditLog({
        req,
        action: 'APPLICATION_STATUS_UPDATE_FAILED',
        entityType: 'Application',
        entityId: id,
        targetUserId: application.candidateId,
        status: 'failure',
        metadata: {
          reason: 'Unauthorized status update attempt',
          attemptedStatus: status,
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application'
      });
    }

    const previousStatus = application.status;
    const nextStatus = status ?? application.status;

    await application.update({
      status: nextStatus,
      interviewDate: interviewDate ?? application.interviewDate,
      notes: notes ?? application.notes
    });

    await writeAuditLog({
      req,
      action: 'APPLICATION_STATUS_UPDATED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: application.candidateId,
      metadata: {
        jobId: application.jobId,
        previousStatus,
        nextStatus,
        interviewDate: interviewDate ?? application.interviewDate,
      },
    });

    const shouldSendStatusEmail =
      application.candidate?.email &&
      nextStatus !== previousStatus &&
      ['shortlisted', 'rejected', 'hired'].includes(nextStatus);

    if (shouldSendStatusEmail) {
      try {
        await sendApplicationStatusEmail(application.candidate.email, {
          candidateName:
            application.candidate?.candidateProfile?.firstName ||
            application.candidate?.email,
          jobTitle: application.job?.title || 'your application',
          status: nextStatus
        });
      } catch (emailError) {
        console.error('updateApplicationStatus email error:', emailError.message);
      }
    }

    const updatedApplication = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile'
            }
          ]
        }
      ]
    });

    await invalidateApplicationRelatedCaches(application.jobId, application.candidateId);

    return res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      data: updatedApplication
    });
  } catch (error) {
    console.error('updateApplicationStatus error:', error);

    await writeAuditLog({
      req,
      action: 'APPLICATION_STATUS_UPDATE_FAILED',
      entityType: 'Application',
      entityId: req.params?.id || null,
      targetUserId: null,
      status: 'failure',
      metadata: {
        error: error.message || 'Internal server error',
        attemptedStatus: req.body?.status || null,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.updateManualReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { manualReviewStatus, notes } = req.body;

    const allowedStatuses = ['pending', 'approved', 'rejected', 'sent_to_employer'];

    if (manualReviewStatus && !allowedStatuses.includes(manualReviewStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid manualReviewStatus value'
      });
    }

    const application = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (req.user.role === 'employer' && application.job?.employerId !== req.user.id) {
      await writeAuditLog({
        req,
        action: 'APPLICATION_MANUAL_REVIEW_FAILED',
        entityType: 'Application',
        entityId: id,
        targetUserId: application.candidateId,
        status: 'failure',
        metadata: {
          reason: 'Unauthorized manual review attempt',
          attemptedManualReviewStatus: manualReviewStatus,
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this application'
      });
    }

    const previousManualReviewStatus = application.manualReviewStatus;

    await application.update({
      manualReviewStatus: manualReviewStatus ?? application.manualReviewStatus,
      notes: notes ?? application.notes,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    });

    const refreshedApplication = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    await writeAuditLog({
      req,
      action: 'APPLICATION_MANUAL_REVIEW_UPDATED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: application.candidateId,
      metadata: {
        jobId: application.jobId,
        previousManualReviewStatus,
        nextManualReviewStatus: refreshedApplication?.manualReviewStatus,
        aiScore: refreshedApplication?.aiScore,
      },
    });

    const fraudCheckResult = await runApplicationFraudChecks(refreshedApplication);

    await writeAuditLog({
      req,
      action: 'APPLICATION_MANUAL_REVIEW_FRAUD_CHECK_COMPLETED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: application.candidateId,
      metadata: {
        jobId: application.jobId,
        manualReviewStatus: refreshedApplication?.manualReviewStatus,
        alertsCreated: fraudCheckResult.alertsCreated,
        rules: fraudCheckResult.alerts.map((item) => item.ruleCode),
      },
    });

    await invalidateApplicationRelatedCaches(application.jobId, application.candidateId);

    return res.status(200).json({
      success: true,
      message: 'Manual review updated successfully',
      data: refreshedApplication,
      fraud: {
        alertsCreated: fraudCheckResult.alertsCreated,
        alerts: fraudCheckResult.alerts,
      }
    });
  } catch (error) {
    console.error('updateManualReview error:', error);

    await writeAuditLog({
      req,
      action: 'APPLICATION_MANUAL_REVIEW_FAILED',
      entityType: 'Application',
      entityId: req.params?.id || null,
      targetUserId: null,
      status: 'failure',
      metadata: {
        error: error.message || 'Internal server error',
        attemptedManualReviewStatus: req.body?.manualReviewStatus || null,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.scheduleInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      interviewDate,
      interviewMode,
      interviewMeetingLink,
      interviewLocation,
      interviewNotes
    } = req.body;

    if (!interviewDate) {
      return res.status(400).json({
        success: false,
        message: 'interviewDate is required'
      });
    }

    if (!interviewMode || !['online', 'offline'].includes(interviewMode)) {
      return res.status(400).json({
        success: false,
        message: 'interviewMode must be either online or offline'
      });
    }

    if (interviewMode === 'online' && !interviewMeetingLink) {
      return res.status(400).json({
        success: false,
        message: 'interviewMeetingLink is required for online interviews'
      });
    }

    if (interviewMode === 'offline' && !interviewLocation) {
      return res.status(400).json({
        success: false,
        message: 'interviewLocation is required for offline interviews'
      });
    }

    const application = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile'
            }
          ]
        }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (req.user.role === 'employer' && application.job?.employerId !== req.user.id) {
      await writeAuditLog({
        req,
        action: 'INTERVIEW_SCHEDULE_FAILED',
        entityType: 'Application',
        entityId: id,
        targetUserId: application.candidateId,
        status: 'failure',
        metadata: {
          reason: 'Unauthorized interview scheduling attempt',
          interviewMode,
          interviewDate,
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Not authorized to schedule interview for this application'
      });
    }

    const isReschedule = !!application.interviewDate;

    await application.update({
      status: 'interview',
      interviewDate,
      interviewMode,
      interviewMeetingLink: interviewMode === 'online' ? interviewMeetingLink : null,
      interviewLocation: interviewMode === 'offline' ? interviewLocation : null,
      interviewNotes: interviewNotes || null,
      interviewStatus: isReschedule ? 'rescheduled' : 'scheduled',
      interviewScheduledBy: req.user.id
    });

    await writeAuditLog({
      req,
      action: isReschedule ? 'INTERVIEW_RESCHEDULED' : 'INTERVIEW_SCHEDULED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: application.candidateId,
      metadata: {
        jobId: application.jobId,
        interviewDate,
        interviewMode,
        interviewMeetingLink: interviewMode === 'online' ? interviewMeetingLink : null,
        interviewLocation: interviewMode === 'offline' ? interviewLocation : null,
      },
    });

    if (application.candidate?.email) {
      try {
        await sendInterviewScheduledEmail(application.candidate.email, {
          candidateName:
            application.candidate?.candidateProfile?.firstName ||
            application.candidate?.email,
          jobTitle: application.job?.title || 'Job Interview',
          companyName: application.job?.companyName || 'InstaHire Employer',
          scheduledAt: interviewDate,
          mode: interviewMode,
          meetingLink: interviewMeetingLink,
          location: interviewLocation,
          notes: interviewNotes
        });
      } catch (emailError) {
        console.error('scheduleInterview email error:', emailError.message);
      }
    }

    const updatedApplication = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile'
            }
          ]
        }
      ]
    });

    await invalidateApplicationRelatedCaches(application.jobId, application.candidateId);

    return res.status(200).json({
      success: true,
      message: isReschedule ? 'Interview rescheduled successfully' : 'Interview scheduled successfully',
      data: updatedApplication
    });
  } catch (error) {
    console.error('scheduleInterview error:', error);

    await writeAuditLog({
      req,
      action: 'INTERVIEW_SCHEDULE_FAILED',
      entityType: 'Application',
      entityId: req.params?.id || null,
      targetUserId: null,
      status: 'failure',
      metadata: {
        error: error.message || 'Internal server error',
        interviewDate: req.body?.interviewDate || null,
        interviewMode: req.body?.interviewMode || null,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.rescreenApplication = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (req.user.role === 'employer' && application.job?.employerId !== req.user.id) {
      await writeAuditLog({
        req,
        action: 'APPLICATION_RESCREEN_FAILED',
        entityType: 'Application',
        entityId: id,
        targetUserId: application.candidateId,
        status: 'failure',
        metadata: {
          reason: 'Unauthorized rescreen attempt',
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Not authorized to rescreen this application'
      });
    }

    if (!application.resumeText) {
      await writeAuditLog({
        req,
        action: 'APPLICATION_RESCREEN_FAILED',
        entityType: 'Application',
        entityId: id,
        targetUserId: application.candidateId,
        status: 'failure',
        metadata: {
          reason: 'No resume text found',
        },
      });

      return res.status(400).json({
        success: false,
        message: 'No resume text found for this application'
      });
    }

    const screening = await screenResumeAgainstJob(application.resumeText, application.job);

    await application.update({
      aiScore: screening.aiScore,
      aiStatus: screening.aiStatus,
      aiSummary: screening.aiSummary,
      matchedSkills: screening.matchedSkills,
      missingSkills: screening.missingSkills,
      aiRawResponse: screening.aiRawResponse,
      screenedAt: new Date(),
      manualReviewStatus: 'pending'
    });

    const refreshedApplication = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    await writeAuditLog({
      req,
      action: 'APPLICATION_RESCREENED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: application.candidateId,
      metadata: {
        jobId: application.jobId,
        aiStatus: refreshedApplication?.aiStatus,
        aiScore: refreshedApplication?.aiScore,
        manualReviewStatus: refreshedApplication?.manualReviewStatus,
      },
    });

    const fraudCheckResult = await runApplicationFraudChecks(refreshedApplication);

    await writeAuditLog({
      req,
      action: 'APPLICATION_RESCREEN_FRAUD_CHECK_COMPLETED',
      entityType: 'Application',
      entityId: application.id,
      targetUserId: application.candidateId,
      metadata: {
        jobId: application.jobId,
        aiStatus: refreshedApplication?.aiStatus,
        aiScore: refreshedApplication?.aiScore,
        alertsCreated: fraudCheckResult.alertsCreated,
        rules: fraudCheckResult.alerts.map((item) => item.ruleCode),
      },
    });

    await invalidateApplicationRelatedCaches(application.jobId, application.candidateId);

    return res.status(200).json({
      success: true,
      message: 'Application rescreened successfully',
      data: refreshedApplication,
      fraud: {
        alertsCreated: fraudCheckResult.alertsCreated,
        alerts: fraudCheckResult.alerts,
      }
    });
  } catch (error) {
    console.error('rescreenApplication error:', error);

    await writeAuditLog({
      req,
      action: 'APPLICATION_RESCREEN_FAILED',
      entityType: 'Application',
      entityId: req.params?.id || null,
      targetUserId: null,
      status: 'failure',
      metadata: {
        error: error.message || 'Internal server error',
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (req.user.role === 'candidate' && application.candidateId !== req.user.id) {
      await writeAuditLog({
        req,
        action: 'APPLICATION_DELETE_FAILED',
        entityType: 'Application',
        entityId: id,
        targetUserId: application.candidateId,
        status: 'failure',
        metadata: {
          reason: 'Unauthorized delete attempt by candidate',
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this application'
      });
    }

    if (req.user.role === 'employer' && application.job?.employerId !== req.user.id) {
      await writeAuditLog({
        req,
        action: 'APPLICATION_DELETE_FAILED',
        entityType: 'Application',
        entityId: id,
        targetUserId: application.candidateId,
        status: 'failure',
        metadata: {
          reason: 'Unauthorized delete attempt by employer',
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this application'
      });
    }

    const deletedSnapshot = {
      applicationId: application.id,
      jobId: application.jobId,
      candidateId: application.candidateId,
      status: application.status,
      manualReviewStatus: application.manualReviewStatus,
      aiStatus: application.aiStatus,
    };

    if (application.resumeUrl) {
      const fileName = path.basename(application.resumeUrl);
      const filePath = path.join(__dirname, '../../uploads/resumes', fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await application.destroy();

    await writeAuditLog({
      req,
      action: 'APPLICATION_DELETED',
      entityType: 'Application',
      entityId: deletedSnapshot.applicationId,
      targetUserId: deletedSnapshot.candidateId,
      metadata: deletedSnapshot,
    });

    await invalidateApplicationRelatedCaches(
      deletedSnapshot.jobId,
      deletedSnapshot.candidateId
    );

    return res.status(200).json({
      success: true,
      message: 'Application deleted successfully'
    });
  } catch (error) {
    console.error('deleteApplication error:', error);

    await writeAuditLog({
      req,
      action: 'APPLICATION_DELETE_FAILED',
      entityType: 'Application',
      entityId: req.params?.id || null,
      targetUserId: null,
      status: 'failure',
      metadata: {
        error: error.message || 'Internal server error',
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};