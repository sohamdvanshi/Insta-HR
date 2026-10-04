const { DataTypes } = require('sequelize')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const sequelize = require('../config/database')

const REFERRAL_CODE_PREFIX = 'INSTA'
const REFERRAL_CODE_RANDOM_LENGTH = 7
const REFERRAL_CODE_MAX_LENGTH = (
  REFERRAL_CODE_PREFIX.length + REFERRAL_CODE_RANDOM_LENGTH
)
const REFERRAL_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const SYSTEM_ROLES = ['candidate', 'employer', 'admin', 'super_admin', 'trainer']

const normalizeEmail = (value) => {
  if (value === null || value === undefined) return null
  return String(value).trim().toLowerCase()
}

const normalizeReferralCode = (value) => {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim().toUpperCase()
}

const generateReferralCode = () => {
  const bytes = crypto.randomBytes(REFERRAL_CODE_RANDOM_LENGTH)
  let randomPart = ''

  for (let index = 0; index < REFERRAL_CODE_RANDOM_LENGTH; index += 1) {
    randomPart += REFERRAL_CHARACTERS[
      bytes[index] % REFERRAL_CHARACTERS.length
    ]
  }

  return `${REFERRAL_CODE_PREFIX}${randomPart}`
}

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      set(value) {
        this.setDataValue('email', normalizeEmail(value))
      },
      validate: {
        isEmail: {
          msg: 'Please provide a valid email address'
        },
        notEmpty: {
          msg: 'Email is required'
        }
      }
    },

    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
      set(value) {
        const normalized = value === null || value === undefined
          ? null
          : String(value).trim()

        this.setDataValue('phone', normalized || null)
      }
    },

    password: {
      type: DataTypes.STRING,
      allowNull: true
    },

    googleId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    authProvider: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'local',
      validate: {
        isIn: {
          args: [['local', 'google']],
          msg: 'authProvider must be local or google'
        }
      }
    },

    avatar: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    role: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'candidate',
      validate: {
        isIn: {
          args: [SYSTEM_ROLES],
          msg: 'Invalid user role'
        }
      }
    },

    referralCode: {
      type: DataTypes.STRING(REFERRAL_CODE_MAX_LENGTH),
      allowNull: true,
      set(value) {
        this.setDataValue(
          'referralCode',
          normalizeReferralCode(value)
        )
      },
      validate: {
        isValidReferralCode(value) {
          if (!value) return

          const expectedLength = (
            REFERRAL_CODE_PREFIX.length + REFERRAL_CODE_RANDOM_LENGTH
          )

          const valid = (
            value.length === expectedLength &&
            value.startsWith(REFERRAL_CODE_PREFIX) &&
            /^[A-Z0-9]+$/.test(value)
          )

          if (!valid) {
            throw new Error('Invalid referral code format')
          }
        }
      }
    },

    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    otp: {
      type: DataTypes.STRING(10),
      allowNull: true
    },

    otpExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },

    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },

    subscriptionExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },

    subscriptionPlan: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    subscriptionReminder7Sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    subscriptionReminder1Sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    subscriptionExpiredMailSent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    tableName: 'Users',
    timestamps: true,
    hooks: {
      beforeValidate(user) {
        user.email = normalizeEmail(user.email)
        user.referralCode = normalizeReferralCode(user.referralCode)

        if (user.role === 'candidate' && !user.referralCode) {
          user.referralCode = generateReferralCode()
        }
      }
    }
  }
)

User.prototype.comparePassword = async function comparePassword(password) {
  if (!this.password || password === null || password === undefined) {
    return false
  }

  return bcrypt.compare(String(password), this.password)
}

User.generateReferralCode = generateReferralCode
User.normalizeEmail = normalizeEmail
User.normalizeReferralCode = normalizeReferralCode
User.SYSTEM_ROLES = SYSTEM_ROLES

module.exports = User
