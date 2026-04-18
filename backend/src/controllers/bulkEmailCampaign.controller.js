const { BulkEmailCampaign, Job, Application, User } = require('../models');
const { sendBulkCampaignEmail } = require('../services/email/emailService');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.createCampaign = async (req, res) => {
  try {
    const { jobId, subject, message } = req.body;

    if (!jobId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'jobId, subject, and message are required',
      });
    }

    const job = await Job.findByPk(jobId);

    if (!job || job.employerId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized',
      });
    }

    const shortlistedCount = await Application.count({
      where: {
        jobId,
        status: 'shortlisted',
      },
    });

    const campaign = await BulkEmailCampaign.create({
      employerId: req.user.id,
      jobId,
      subject,
      message,
      recipientCount: shortlistedCount,
      status: 'draft',
    });

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign,
    });
  } catch (error) {
    console.error('createCampaign error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyCampaigns = async (req, res) => {
  try {
    const campaigns = await BulkEmailCampaign.findAll({
      where: {
        employerId: req.user.id,
      },
      include: [
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'title', 'companyName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      count: campaigns.length,
      data: campaigns,
    });
  } catch (error) {
    console.error('getMyCampaigns error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getShortlistedCandidatesForJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findByPk(jobId);

    if (!job || job.employerId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized',
      });
    }

    const applications = await Application.findAll({
      where: {
        jobId,
        status: 'shortlisted',
      },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (error) {
    console.error('getShortlistedCandidatesForJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await BulkEmailCampaign.findByPk(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    if (campaign.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const job = await Job.findByPk(campaign.jobId);

    if (!job || job.employerId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized',
      });
    }

    const applications = await Application.findAll({
      where: {
        jobId: campaign.jobId,
        status: 'shortlisted',
      },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    if (!applications.length) {
      return res.status(400).json({
        success: false,
        message: 'No shortlisted candidates found for this job',
      });
    }

    await campaign.update({
      status: 'sending',
      recipientCount: applications.length,
      sentCount: 0,
      failedCount: 0,
    });

    let sentCount = 0;
    let failedCount = 0;

    const batchSize = 20;

    for (let i = 0; i < applications.length; i += batchSize) {
      const batch = applications.slice(i, i + batchSize);

      for (const application of batch) {
        try {
          const candidate = application.candidate;
          if (!candidate?.email) {
            failedCount++;
            continue;
          }

          await sendBulkCampaignEmail({
            to: candidate.email,
            candidateName: candidate.email || 'Candidate',
            subject: campaign.subject,
            message: campaign.message,
            jobTitle: job.title,
            companyName: job.companyName || 'InstaHire Employer',
          });

          sentCount++;
          console.log(`✅ Bulk email sent to ${candidate.email}`);
        } catch (error) {
          failedCount++;
          console.error(
            `❌ Failed bulk email for ${application.candidate?.email}:`,
            error.message
          );
        }
      }

      await sleep(1500);
    }

    await campaign.update({
      sentCount,
      failedCount,
      status: failedCount > 0 ? 'sent' : 'sent',
      sentAt: new Date(),
    });

    return res.json({
      success: true,
      message: 'Campaign sent successfully',
      data: {
        recipientCount: applications.length,
        sentCount,
        failedCount,
      },
    });
  } catch (error) {
    console.error('sendCampaign error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};