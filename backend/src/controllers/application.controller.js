const fs = require('fs');
const path = require('path');
const { Application, Job, User, CandidateProfile } = require('../models');
const { extractResumeText } = require('../services/ai/resumeParserService');
const { screenResumeAgainstJob } = require('../services/ai/resumeScreeningService');

exports.applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { coverLetter } = req.body;

    const job = await Job.findByPk(jobId);

    if (!job) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

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

      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    if (!req.file) {
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

    const updatedApplication = await Application.findByPk(application.id, {
      include: [
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Applied successfully and resume screened',
      data: updatedApplication
    });
  } catch (error) {
    console.error('applyToJob error:', error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

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
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application'
      });
    }

    await application.update({
      status: status ?? application.status,
      interviewDate: interviewDate ?? application.interviewDate,
      notes: notes ?? application.notes
    });

    return res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      data: application
    });
  } catch (error) {
    console.error('updateApplicationStatus error:', error);
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
      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this application'
      });
    }

    await application.update({
      manualReviewStatus: manualReviewStatus ?? application.manualReviewStatus,
      notes: notes ?? application.notes,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Manual review updated successfully',
      data: application
    });
  } catch (error) {
    console.error('updateManualReview error:', error);
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
      return res.status(403).json({
        success: false,
        message: 'Not authorized to rescreen this application'
      });
    }

    if (!application.resumeText) {
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

    return res.status(200).json({
      success: true,
      message: 'Application rescreened successfully',
      data: application
    });
  } catch (error) {
    console.error('rescreenApplication error:', error);
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
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this application'
      });
    }

    if (req.user.role === 'employer' && application.job?.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this application'
      });
    }

    if (application.resumeUrl) {
      const fileName = path.basename(application.resumeUrl);
      const filePath = path.join(__dirname, '../../uploads/resumes', fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await application.destroy();

    return res.status(200).json({
      success: true,
      message: 'Application deleted successfully'
    });
  } catch (error) {
    console.error('deleteApplication error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};