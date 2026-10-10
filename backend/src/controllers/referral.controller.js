const { Op } = require('sequelize')
const {
  Application,
  User,
  Job,
  LoyaltyPointTransaction
} = require('../models')
const {
  DEFAULT_REFERRAL_REWARD_POINTS,
  awardReferralReward
} = require('../services/referralReward.service')

const isAdmin = (req) => ['admin', 'super_admin'].includes(req.user?.role)
const isEmployer = (req) => req.user?.role === 'employer'
const isCandidate = (req) => req.user?.role === 'candidate'
const getId = (value) => (value ? String(value) : null)
const serialize = (value) => (
  value && typeof value.toJSON === 'function'
    ? value.toJSON()
    : value || null
)

const applicationIncludes = [
  {
    model: User,
    as: 'candidate',
    attributes: ['id', 'email', 'phone', 'role'],
    required: false
  },
  {
    model: User,
    as: 'referrer',
    attributes: ['id', 'email', 'phone', 'role', 'referralCode'],
    required: false
  },
  {
    model: Job,
    as: 'job',
    attributes: ['id', 'title', 'employerId'],
    required: false
  }
]

const getApplicationStatusFilter = (status) => {
  const allowed = [
    'applied',
    'shortlisted',
    'interview',
    'rejected',
    'hired'
  ]

  if (!status) return null

  if (!allowed.includes(status)) {
    const error = new Error('Invalid application status')
    error.statusCode = 400
    throw error
  }

  return status
}

const getReferralStatus = (application) => {
  const status = application.status || 'applied'
  const rewarded = Boolean(application.referralRewarded)

  if (status === 'hired') {
    return rewarded ? 'rewarded' : 'eligible'
  }

  return status
}

const getRewardStatus = (application) => {
  const status = application.status || 'applied'
  const rewarded = Boolean(application.referralRewarded)

  if (rewarded) return 'paid'
  if (status === 'hired') return 'eligible'
  if (status === 'rejected') return 'not_eligible'

  return 'pending'
}

const getCandidateName = (candidate) => {
  if (!candidate) return null

  if (candidate.name) return candidate.name

  const profile = candidate.candidateProfile
  if (!profile) return null

  return [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ') || null
}

const serializeTrackedReferral = (application) => {
  const item = serialize(application)
  const candidate = item.candidate || null
  const referrer = item.referrer || null
  const job = item.job || null

  return {
    ...item,

    // Fields used by the employer referral tracking page.
    applicationStatus: item.status || 'applied',
    referralStatus: getReferralStatus(item),
    rewardStatus: getRewardStatus(item),
    rewardPoints: Number(item.referralRewardPoints || 0),
    rewardedAt: item.referralRewardedAt || null,
    referralCode: item.referralCodeUsed || referrer?.referralCode || null,

    candidate: candidate
      ? {
          id: candidate.id,
          email: candidate.email,
          phone: candidate.phone,
          name: getCandidateName(candidate)
        }
      : null,

    referrer: referrer
      ? {
          id: referrer.id,
          email: referrer.email,
          phone: referrer.phone,
          role: referrer.role,
          name: referrer.name || null,
          referralCode: referrer.referralCode || null
        }
      : null,

    job: job
      ? {
          id: job.id,
          title: job.title,
          employerId: job.employerId
        }
      : null
  }
}

exports.getMyReferralCode = async (req, res) => {
  try {
    if (!isCandidate(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only candidates have referral codes'
      })
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'role', 'referralCode']
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    return res.json({
      success: true,
      data: {
        referralCode: user.referralCode || null
      }
    })
  } catch (error) {
    console.error('getMyReferralCode error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch referral code'
    })
  }
}

exports.getMyReferrals = async (req, res) => {
  try {
    if (!isCandidate(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only candidates can view their referrals'
      })
    }

    const status = getApplicationStatusFilter(req.query.status)
    const where = { referredByUserId: req.user.id }

    if (status) where.status = status

    const applications = await Application.findAll({
      where,
      include: applicationIncludes,
      order: [['createdAt', 'DESC']]
    })

    const data = applications.map((application) => {
      const item = serialize(application)
      const rewarded = Boolean(item.referralRewarded)

      return {
        ...item,
        referralCode: item.referralCodeUsed || null,
        referralStatus: item.status === 'hired'
          ? rewarded ? 'rewarded' : 'eligible'
          : item.status,
        rewardStatus: rewarded
          ? 'paid'
          : item.status === 'hired'
            ? 'eligible'
            : 'not_eligible',
        rewardPoints: Number(item.referralRewardPoints || 0)
      }
    })

    return res.json({
      success: true,
      count: data.length,
      data
    })
  } catch (error) {
    console.error('getMyReferrals error:', error)
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch referrals'
    })
  }
}

exports.getMyLoyaltyPoints = async (req, res) => {
  try {
    if (!isCandidate(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only candidates can view loyalty points'
      })
    }

    const transactions = await LoyaltyPointTransaction.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Application,
          as: 'application',
          attributes: ['id', 'jobId', 'status', 'referralCodeUsed'],
          required: false,
          include: [
            {
              model: Job,
              as: 'job',
              attributes: ['id', 'title'],
              required: false
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    const balance = transactions.reduce(
      (total, transaction) => total + Number(transaction.points || 0),
      0
    )

    return res.json({
      success: true,
      balance,
      transactions: transactions.map(serialize)
    })
  } catch (error) {
    console.error('getMyLoyaltyPoints error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch loyalty points'
    })
  }
}

const getTrackedReferrals = async (req, res, adminOnly = false) => {
  if (adminOnly ? !isAdmin(req) : !isEmployer(req) && !isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: adminOnly
        ? 'Only admins can view all referrals'
        : 'Only employers and admins can view referrals'
    })
  }

  const status = getApplicationStatusFilter(req.query.status)
  const where = {
    referredByUserId: {
      [Op.ne]: null
    }
  }

  if (status) where.status = status

  const include = applicationIncludes.map((item) => ({ ...item }))

  if (isEmployer(req)) {
    const index = include.findIndex((item) => item.as === 'job')
    const employerJob = {
      model: Job,
      as: 'job',
      attributes: ['id', 'title', 'employerId'],
      where: {
        employerId: req.user.id
      },
      required: true
    }

    if (index >= 0) include[index] = employerJob
    else include.push(employerJob)
  }

  const applications = await Application.findAll({
    where,
    include,
    order: [['createdAt', 'DESC']]
  })

  const data = applications.map(serializeTrackedReferral)

  return res.json({
    success: true,
    count: data.length,
    data
  })
}

exports.getEmployerReferrals = async (req, res) => {
  try {
    return await getTrackedReferrals(req, res, false)
  } catch (error) {
    console.error('getEmployerReferrals error:', error)
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch employer referrals'
    })
  }
}

exports.getAdminReferrals = async (req, res) => {
  try {
    return await getTrackedReferrals(req, res, true)
  } catch (error) {
    console.error('getAdminReferrals error:', error)
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch admin referrals'
    })
  }
}

exports.awardReferralPoints = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can award referral points'
      })
    }

    const application = await Application.findByPk(
      req.params.applicationId
    )

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      })
    }

    if (!application.referredByUserId) {
      return res.status(400).json({
        success: false,
        message: 'This application has no referrer'
      })
    }

    if (application.status !== 'hired') {
      return res.status(400).json({
        success: false,
        message: 'Points can only be awarded after the candidate is hired'
      })
    }

    const requestedPoints = Number(req.body?.points)
    const points = Number.isInteger(requestedPoints) && requestedPoints > 0
      ? requestedPoints
      : DEFAULT_REFERRAL_REWARD_POINTS

    const result = await awardReferralReward({
      applicationId: application.id,
      points,
      createdBy: req.user.id,
      reason: req.body?.reason || 'Referral bonus for hired candidate'
    })

    if (result.alreadyRewarded) {
      return res.status(409).json({
        success: false,
        message: 'Referral points have already been awarded',
        data: {
          applicationId: application.id,
          userId: application.referredByUserId,
          points: result.points,
          transaction: serialize(result.transaction)
        }
      })
    }

    if (!result.rewarded) {
      return res.status(400).json({
        success: false,
        message: result.reason || 'Referral points were not awarded'
      })
    }

    return res.status(201).json({
      success: true,
      message: 'Referral points awarded successfully',
      data: {
        applicationId: application.id,
        userId: application.referredByUserId,
        points: result.points,
        transaction: serialize(result.transaction)
      }
    })
  } catch (error) {
    console.error('awardReferralPoints error:', error)
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to award referral points'
    })
  }
}

exports.createReferral = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Manual referral creation is no longer supported. Use the referrer referralCode while applying for a job.'
  })
}

exports.updateReferralStatus = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Referral status is now controlled by the related application status.'
  })
}

exports.getReferralById = async (req, res) => {
  try {
    const application = await Application.findByPk(req.params.id, {
      include: applicationIncludes
    })

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Referred application not found'
      })
    }

    const canView = (
      isAdmin(req) ||
      getId(application.referredByUserId) === getId(req.user.id) ||
      getId(application.candidateId) === getId(req.user.id) ||
      (
        isEmployer(req) &&
        getId(application.job?.employerId) === getId(req.user.id)
      )
    )

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this referral'
      })
    }

    return res.json({
      success: true,
      data: serialize(application)
    })
  } catch (error) {
    console.error('getReferralById error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch referral'
    })
  }
}