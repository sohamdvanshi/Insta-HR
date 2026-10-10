const { BulkEmailCampaign, Job, Application, User, CandidateProfile } = require('../models')
const { sendBulkCampaignEmail } = require('../services/email/emailService')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ALLOWED_RECIPIENT_STATUSES = ['applied', 'shortlisted', 'hired', 'rejected']

const normalizeRecipientStatus = (value) => {
  if (!value) return 'shortlisted'

  const status = String(value).toLowerCase().trim()
  return ALLOWED_RECIPIENT_STATUSES.includes(status) ? status : null
}

const buildCandidateName = (candidate) => {
  if (!candidate) return 'Candidate'

  const profile = candidate.candidateProfile
  const name = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()

  return name || candidate.email || 'Candidate'
}

const getRecipientWhere = ({ jobId, recipientStatus }) => {
  if (recipientStatus === 'shortlisted') {
    return { jobId, status: 'shortlisted' }
  }

  if (recipientStatus === 'applied') {
    return { jobId, status: 'applied' }
  }

  if (recipientStatus === 'hired') {
    return { jobId, status: 'hired' }
  }

  if (recipientStatus === 'rejected') {
    return { jobId, status: 'rejected' }
  }

  return { jobId, status: 'shortlisted' }
}

exports.createCampaign = async (req, res) => {
  try {
    const { jobId, subject, message, recipientStatus } = req.body

    if (!jobId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'jobId, subject, and message are required'
      })
    }

    const selectedRecipientStatus = normalizeRecipientStatus(recipientStatus)
    if (!selectedRecipientStatus) {
      return res.status(400).json({
        success: false,
        message: 'recipientStatus must be one of applied, shortlisted, hired, or rejected'
      })
    }

    const job = await Job.findByPk(jobId)
    if (!job || job.employerId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized'
      })
    }

    const recipientCount = await Application.count({
      where: getRecipientWhere({ jobId, recipientStatus: selectedRecipientStatus })
    })

    const campaign = await BulkEmailCampaign.create({
      employerId: req.user.id,
      jobId,
      subject,
      message,
      recipientCount,
      recipientStatus: selectedRecipientStatus,
      status: 'draft',
      sentCount: 0,
      failedCount: 0
    })

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign
    })
  } catch (error) {
    console.error('createCampaign error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.getMyCampaigns = async (req, res) => {
  try {
    const campaigns = await BulkEmailCampaign.findAll({
      where: {
        employerId: req.user.id
      },
      include: [
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'title', 'companyName']
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    return res.json({
      success: true,
      count: campaigns.length,
      data: campaigns
    })
  } catch (error) {
    console.error('getMyCampaigns error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.getCandidatesForJobByStatus = async (req, res) => {
  try {
    const { jobId } = req.params
    const requestedStatus = normalizeRecipientStatus(req.query.status)

    if (!requestedStatus) {
      return res.status(400).json({
        success: false,
        message: 'status must be one of applied, shortlisted, hired, or rejected'
      })
    }

    const job = await Job.findByPk(jobId)
    if (!job || job.employerId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized'
      })
    }

    const applications = await Application.findAll({
      where: {
        jobId,
        status: requestedStatus
      },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile',
              attributes: ['firstName', 'lastName']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    const data = applications.map((application) => {
      const item = application.toJSON()
      return {
        ...item,
        candidateName: buildCandidateName(item.candidate)
      }
    })

    return res.json({
      success: true,
      count: data.length,
      data
    })
  } catch (error) {
    console.error('getCandidatesForJobByStatus error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.getShortlistedCandidatesForJob = async (req, res) => {
  try {
    const { jobId } = req.params

    const job = await Job.findByPk(jobId)
    if (!job || job.employerId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized'
      })
    }

    const applications = await Application.findAll({
      where: {
        jobId,
        status: 'shortlisted'
      },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile',
              attributes: ['firstName', 'lastName']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    const data = applications.map((application) => {
      const item = application.toJSON()
      return {
        ...item,
        candidateName: buildCandidateName(item.candidate)
      }
    })

    return res.json({
      success: true,
      count: data.length,
      data
    })
  } catch (error) {
    console.error('getShortlistedCandidatesForJob error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.sendCampaign = async (req, res) => {
  let claimedCampaign = null
  let sentCount = 0
  let failedCount = 0
  try {
    const { id } = req.params

    const campaign = await BulkEmailCampaign.findByPk(id)
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      })
    }

    if (campaign.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      })
    }

    if (campaign.status !== 'draft') {
      return res.status(409).json({ success: false, message: 'Campaign has already been sent or started. Review its delivery results.' })
    }

    const job = await Job.findByPk(campaign.jobId)
    if (!job || job.employerId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized'
      })
    }

    const targetStatus = normalizeRecipientStatus(campaign.recipientStatus) || 'shortlisted'
    const applications = await Application.findAll({
      where: getRecipientWhere({
        jobId: campaign.jobId,
        recipientStatus: targetStatus
      }),
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile',
              attributes: ['firstName', 'lastName']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    if (!applications.length) {
      return res.status(400).json({
        success: false,
        message: `No ${targetStatus} candidates found for this job`
      })
    }

    const [claimed] = await BulkEmailCampaign.update({
      status: 'sending', recipientCount: applications.length, sentCount: 0, failedCount: 0
    }, { where: { id: campaign.id, employerId: req.user.id, status: 'draft' } })
    if (!claimed) return res.status(409).json({ success: false, message: 'Campaign has already been sent or started. Review its delivery results.' })
    claimedCampaign = campaign
    const batchSize = 20

    for (let i = 0; i < applications.length; i += batchSize) {
      const batch = applications.slice(i, i + batchSize)

      for (const application of batch) {
        try {
          const candidate = application.candidate
          if (!candidate?.email) {
            failedCount++
            continue
          }

          await sendBulkCampaignEmail({
            to: candidate.email,
            candidateName: buildCandidateName(candidate),
            subject: campaign.subject,
            message: campaign.message,
            jobTitle: job.title,
            companyName: job.companyName || 'InstaHire Employer'
          })

          sentCount++
          console.log(`✅ Bulk email sent to ${candidate.email}`)
        } catch (error) {
          failedCount++
          console.error(
            `❌ Failed bulk email for ${application.candidate?.email}:`,
            error.message
          )
        }
      }

      await campaign.update({ sentCount, failedCount })
      if (i + batchSize < applications.length) await sleep(1500)
    }

    await campaign.update({
      sentCount,
      failedCount,
      status: sentCount ? 'sent' : 'failed',
      sentAt: sentCount ? new Date() : null
    })

    return res.json({
      success: true,
      message: failedCount ? `Emails sent: ${sentCount}. Failed: ${failedCount}.` : 'Campaign sent successfully',
      data: {
        recipientStatus: targetStatus,
        recipientCount: applications.length,
        sentCount,
        failedCount
      }
    })
  } catch (error) {
    if (claimedCampaign) {
      try { await claimedCampaign.update({ sentCount, failedCount, status: 'failed' }) } catch (saveError) { console.error('Unable to persist campaign failure:', saveError.message) }
    }
    console.error('sendCampaign error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
