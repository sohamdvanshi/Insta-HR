const {
  sequelize,
  Job,
  Application,
  CandidateProfile,
  User
} = require('../models')

const {
  DEFAULT_REFERRAL_REWARD_POINTS,
  awardReferralReward
} = require('../services/referralReward.service')

const VALID_APPLICATION_STATUSES = [
  'applied',
  'shortlisted',
  'interview',
  'hired',
  'rejected'
]

const BACKEND_BASE_URL = (
  process.env.BACKEND_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:5000'
).replace(/\/$/, '')

function normalizeSkill(skill) {
  return String(skill || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, '')
    .trim()
}

function skillMatchScore(jobSkills = [], candidateSkills = []) {
  const job = jobSkills.map(normalizeSkill).filter(Boolean)
  const candidate = new Set(
    candidateSkills.map(normalizeSkill).filter(Boolean)
  )

  if (!job.length) return 50

  const matched = job.filter((skill) => candidate.has(skill))
  return Math.round((matched.length / job.length) * 100)
}

function getMatchedSkills(jobSkills = [], candidateSkills = []) {
  const candidate = new Set(
    candidateSkills.map(normalizeSkill).filter(Boolean)
  )

  return jobSkills.filter((skill) =>
    candidate.has(normalizeSkill(skill))
  )
}

function getMissingSkills(jobSkills = [], candidateSkills = []) {
  const candidate = new Set(
    candidateSkills.map(normalizeSkill).filter(Boolean)
  )

  return jobSkills.filter(
    (skill) => !candidate.has(normalizeSkill(skill))
  )
}

function experienceMatchScore(jobExpMin = 0, candidateExp = 0) {
  if (jobExpMin === 0) return 100
  if (candidateExp >= jobExpMin) return 100
  if (candidateExp === 0) return 10

  return Math.min(
    100,
    Math.round((candidateExp / jobExpMin) * 80)
  )
}

function keywordScore(jobDescription = '', profile = {}) {
  if (!jobDescription) return 50

  const experienceText = Array.isArray(profile.experience)
    ? profile.experience
        .map((item) => [
          item.title,
          item.jobTitle,
          item.company,
          item.description
        ].filter(Boolean).join(' '))
        .join(' ')
    : ''

  const text = [
    profile.summary,
    profile.headline,
    Array.isArray(profile.skills)
      ? profile.skills.join(' ')
      : '',
    experienceText
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'this', 'that',
    'from', 'have', 'will', 'your', 'their',
    'about', 'into', 'required', 'years'
  ])

  const keywords = [
    ...new Set(
      jobDescription
        .toLowerCase()
        .split(/\W+/)
        .filter((word) =>
          word.length > 3 && !stopWords.has(word)
        )
    )
  ]

  if (!keywords.length) return 50

  const matched = keywords.filter((keyword) =>
    text.includes(keyword)
  )

  return Math.round((matched.length / keywords.length) * 100)
}

function overallScore(skill, experience, keyword) {
  return Math.round(
    skill * 0.5 + experience * 0.3 + keyword * 0.2
  )
}

function getLabel(score) {
  if (score >= 80) return 'Excellent Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Partial Match'
  return 'Low Match'
}

function getLabelColor(score) {
  if (score >= 80) return 'green'
  if (score >= 60) return 'blue'
  if (score >= 40) return 'yellow'
  return 'red'
}

function getJobOwnerId(job) {
  return job.employerId || job.userId || job.createdBy
}

function getProfileData(profile) {
  if (!profile) return {}
  return typeof profile.toJSON === 'function'
    ? profile.toJSON()
    : profile
}

function getApplicationData(application) {
  return typeof application.toJSON === 'function'
    ? application.toJSON()
    : application
}

function makeAbsoluteResumeUrl(resumeUrl) {
  if (!resumeUrl) return null

  if (/^https?:\/\//i.test(resumeUrl)) {
    return resumeUrl
  }

  return `${BACKEND_BASE_URL}/${String(resumeUrl).replace(/^\/+/, '')}`
}

function buildScreeningComment({
  overall,
  matchedSkills,
  missingSkills,
  candidateExp,
  jobExpMin,
  keywordPct,
  resumeUploaded
}) {
  const reasons = []

  if (matchedSkills.length) {
    reasons.push(
      `Matched skills: ${matchedSkills.slice(0, 5).join(', ')}`
    )
  } else {
    reasons.push('No listed required skills matched')
  }

  if (missingSkills.length) {
    reasons.push(
      `Missing skills: ${missingSkills.slice(0, 5).join(', ')}`
    )
  } else if (matchedSkills.length) {
    reasons.push('All listed required skills matched')
  }

  if (jobExpMin > 0) {
    reasons.push(
      candidateExp >= jobExpMin
        ? `Experience meets the ${jobExpMin}-year minimum`
        : `${candidateExp} years listed against a ${jobExpMin}-year minimum`
    )
  }

  reasons.push(
    keywordPct >= 70
      ? 'Strong keyword relevance'
      : keywordPct >= 40
        ? 'Moderate keyword relevance'
        : 'Limited keyword relevance'
  )

  reasons.push(
    resumeUploaded
      ? 'Application resume is available to the employer'
      : 'No resume was uploaded with this application'
  )

  return `${getLabel(overall)}. ${reasons.join('. ')}.`
}

exports.screenCandidates = async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await Job.findByPk(jobId)

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      })
    }

    const ownerId = getJobOwnerId(job)
    if (
      !['admin', 'super_admin'].includes(req.user.role) &&
      String(ownerId) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to screen this job'
      })
    }

    const applications = await Application.findAll({
      where: { jobId },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    const jobSkills = Array.isArray(job.requiredSkills)
      ? job.requiredSkills
      : []
    const jobExpMin = Number(job.minExperienceYears || 0)

    const candidateIds = [
      ...new Set(
        applications
          .map((application) => application.candidateId)
          .filter(Boolean)
      )
    ]

    const profiles = await CandidateProfile.findAll({
      where: { userId: candidateIds }
    })

    const profileMap = new Map(
      profiles.map((profile) => [
        String(profile.userId),
        getProfileData(profile)
      ])
    )

    const results = applications.map((application) => {
      const applicationData = getApplicationData(application)
      const profile = profileMap.get(
        String(application.candidateId)
      ) || {}
      const user = application.candidate || {}
      const candidateSkills = Array.isArray(profile.skills)
        ? profile.skills
        : []
      const candidateExp = Number(
        profile.yearsOfExperience || 0
      )
      const resumeUrl = makeAbsoluteResumeUrl(
        applicationData.resumeUrl
      )
      const resumeUploaded = Boolean(
        resumeUrl ||
        applicationData.resumeFilename ||
        applicationData.resumeText
      )
      const skillMatch = skillMatchScore(
        jobSkills,
        candidateSkills
      )
      const experienceMatch = experienceMatchScore(
        jobExpMin,
        candidateExp
      )
      const keywordRelevance = keywordScore(
        job.description || '',
        profile
      )
      const overall = overallScore(
        skillMatch,
        experienceMatch,
        keywordRelevance
      )
      const matchedSkills = getMatchedSkills(
        jobSkills,
        candidateSkills
      )
      const missingSkills = getMissingSkills(
        jobSkills,
        candidateSkills
      )
      const screeningComment = buildScreeningComment({
        overall,
        matchedSkills,
        missingSkills,
        candidateExp,
        jobExpMin,
        keywordPct: keywordRelevance,
        resumeUploaded
      })

      return {
        applicationId: application.id,
        applicationStatus:
          applicationData.status === 'pending'
            ? 'applied'
            : applicationData.status || 'applied',
        userId: application.candidateId,
        name: user.email
          ? user.email.split('@')[0]
          : 'Unknown',
        email: user.email || '',
        photoUrl: profile.photoUrl || null,
        headline: profile.headline || '',
        currentLocation: profile.currentLocation || '',
        yearsOfExperience: candidateExp,
        resumeUrl,
        resumeFilename:
          applicationData.resumeFilename || null,
        resumeUploaded,
        resumeSource: resumeUploaded
          ? 'application'
          : null,
        scores: {
          skillMatch,
          experienceMatch,
          keywordRelevance,
          overall
        },
        matchedSkills,
        missingSkills,
        screeningComment,
        label: getLabel(overall),
        labelColor: getLabelColor(overall),
        appliedAt: application.createdAt
      }
    }).sort((a, b) =>
      b.scores.overall - a.scores.overall
    )

    const summary = {
      total: results.length,
      excellent: results.filter((item) =>
        item.scores.overall >= 80
      ).length,
      good: results.filter((item) =>
        item.scores.overall >= 60 &&
        item.scores.overall < 80
      ).length,
      partial: results.filter((item) =>
        item.scores.overall >= 40 &&
        item.scores.overall < 60
      ).length,
      low: results.filter((item) =>
        item.scores.overall < 40
      ).length,
      avgScore: results.length
        ? Math.round(
            results.reduce(
              (total, item) =>
                total + item.scores.overall,
              0
            ) / results.length
          )
        : 0,
      jobTitle: job.title,
      jobSkills,
      jobExpMin
    }

    return res.json({
      success: true,
      data: results,
      summary
    })
  } catch (error) {
    console.error('AI Screening error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'AI screening failed'
    })
  }
}

exports.updateApplicationStatus = async (req, res) => {
  let transaction = null
  let finished = false

  try {
    const { applicationId } = req.params
    let { status } = req.body

    if (status === 'pending') status = 'applied'

    if (!VALID_APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${VALID_APPLICATION_STATUSES.join(', ')}`
      })
    }

    transaction = await sequelize.transaction()

    const application = await Application.findByPk(
      applicationId,
      {
        transaction,
        lock: transaction.LOCK.UPDATE
      }
    )

    if (!application) {
      await transaction.rollback()
      finished = true
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      })
    }

    const job = await Job.findByPk(application.jobId, {
      transaction
    })

    if (!job) {
      await transaction.rollback()
      finished = true
      return res.status(404).json({
        success: false,
        message: 'Related job not found'
      })
    }

    const ownerId = getJobOwnerId(job)
    if (
      !['admin', 'super_admin'].includes(req.user.role) &&
      String(ownerId) !== String(req.user.id)
    ) {
      await transaction.rollback()
      finished = true
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application'
      })
    }

    const previousStatus = application.status
    await application.update({ status }, { transaction })

    let reward = {
      rewarded: false,
      alreadyRewarded: false,
      points: 0,
      transaction: null
    }

    if (status === 'hired' && previousStatus !== 'hired') {
      reward = await awardReferralReward({
        applicationId: application.id,
        transaction,
        points: DEFAULT_REFERRAL_REWARD_POINTS,
        createdBy: req.user.id,
        reason: 'Referral bonus for hired candidate'
      })
    }

    await transaction.commit()
    finished = true

    return res.json({
      success: true,
      message: reward.rewarded
        ? 'Status updated and referral reward credited'
        : 'Status updated',
      reward: reward.rewarded || reward.alreadyRewarded
        ? {
            points: reward.points,
            alreadyRewarded: reward.alreadyRewarded,
            transactionId: reward.transaction?.id || null
          }
        : null,
      data: application
    })
  } catch (error) {
    if (transaction && !finished) {
      try {
        await transaction.rollback()
      } catch (rollbackError) {
        console.error(
          'AI status rollback error:',
          rollbackError.message
        )
      }
    }

    console.error(
      'Update application status error:',
      error
    )

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    })
  }
}
