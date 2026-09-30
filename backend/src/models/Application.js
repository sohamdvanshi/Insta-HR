const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const APPLICATION_STATUSES = [
  'applied',
  'shortlisted',
  'interview',
  'rejected',
  'hired'
]

const INTERVIEW_MODES = ['online', 'offline']
const INTERVIEW_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'rescheduled'
]
const MANUAL_REVIEW_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'sent_to_employer'
]

const cleanReferralCode = (value) => {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim().toUpperCase()
}

const isValidHttpUrl = (value) => {
  if (!value) return true

  try {
    const parsedUrl = new URL(String(value))
    return ['http:', 'https:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}

const normalizeJsonArray = (value) => {
  if (!Array.isArray(value)) return []
  return value.filter(item => item !== null && item !== undefined)
}

const Application = sequelize.define(
  'Application',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: { args: 4, msg: 'jobId must be a valid UUID' }
      }
    },

    candidateId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: { args: 4, msg: 'candidateId must be a valid UUID' }
      }
    },

    referredByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: { args: 4, msg: 'referredByUserId must be a valid UUID' }
      }
    },

    referralCodeUsed: {
      type: DataTypes.STRING(12),
      allowNull: true,
      set(value) {
        this.setDataValue('referralCodeUsed', cleanReferralCode(value))
      },
      validate: {
        len: {
          args: [1, 12],
          msg: 'Referral code must be between 1 and 12 characters'
        }
      }
    },

    referralRewarded: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    referralRewardedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    referralRewardPoints: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: { msg: 'Referral reward points must be an integer' },
        min: {
          args: [0],
          msg: 'Referral reward points cannot be negative'
        }
      }
    },

    status: {
      type: DataTypes.ENUM(...APPLICATION_STATUSES),
      allowNull: false,
      defaultValue: 'applied'
    },

    coverLetter: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    interviewDate: {
      type: DataTypes.DATE,
      allowNull: true
    },

    interviewMode: {
      type: DataTypes.ENUM(...INTERVIEW_MODES),
      allowNull: true
    },

    interviewMeetingLink: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      validate: {
        isValidHttpUrl(value) {
          if (!isValidHttpUrl(value)) {
            throw new Error(
              'Interview meeting link must be a valid HTTP or HTTPS URL'
            )
          }
        }
      }
    },

    interviewLocation: {
      type: DataTypes.STRING(500),
      allowNull: true
    },

    interviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    interviewStatus: {
      type: DataTypes.ENUM(...INTERVIEW_STATUSES),
      allowNull: true
    },

    interviewScheduledBy: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: { args: 4, msg: 'interviewScheduledBy must be a valid UUID' }
      }
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    resumeUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true
    },

    resumeFilename: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    resumeText: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    aiScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: { args: [0], msg: 'AI score cannot be less than 0' },
        max: { args: [100], msg: 'AI score cannot be greater than 100' }
      }
    },

    aiStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'pending'
    },

    aiSummary: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    matchedSkills: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },

    missingSkills: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },

    aiRawResponse: {
      type: DataTypes.JSON,
      allowNull: true
    },

    screenedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    manualReviewStatus: {
      type: DataTypes.ENUM(...MANUAL_REVIEW_STATUSES),
      allowNull: false,
      defaultValue: 'pending'
    },

    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: { args: 4, msg: 'reviewedBy must be a valid UUID' }
      }
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'applications',
    timestamps: true,
    indexes: [
      {
        name: 'applications_job_candidate_unique',
        unique: true,
        fields: ['jobId', 'candidateId']
      },
      {
        name: 'applications_referred_by_user_idx',
        fields: ['referredByUserId']
      },
      {
        name: 'applications_referral_code_idx',
        fields: ['referralCodeUsed']
      },
      {
        name: 'applications_status_idx',
        fields: ['status']
      },
      {
        name: 'applications_referral_rewarded_idx',
        fields: ['referralRewarded']
      },
      {
        name: 'applications_ai_score_idx',
        fields: ['aiScore']
      },
      {
        name: 'applications_manual_review_status_idx',
        fields: ['manualReviewStatus']
      }
    ],
    hooks: {
      beforeValidate(application) {
        application.referralCodeUsed = cleanReferralCode(
          application.referralCodeUsed
        )
        application.matchedSkills = normalizeJsonArray(
          application.matchedSkills
        )
        application.missingSkills = normalizeJsonArray(
          application.missingSkills
        )

        if (application.referralRewarded && !application.referralRewardedAt) {
          application.referralRewardedAt = new Date()
        }

        if (!application.referralRewarded) {
          application.referralRewardedAt = null
          application.referralRewardPoints = null
        }
      }
    }
  }
)

Application.APPLICATION_STATUSES = APPLICATION_STATUSES
Application.INTERVIEW_MODES = INTERVIEW_MODES
Application.INTERVIEW_STATUSES = INTERVIEW_STATUSES
Application.MANUAL_REVIEW_STATUSES = MANUAL_REVIEW_STATUSES

module.exports = Application