const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const normalizeText = (value) => {
  if (value === null || value === undefined) return value
  const normalized = String(value).trim()
  return normalized || null
}

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
}

const CandidateProfile = sequelize.define(
  'CandidateProfile',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: {
          args: 4,
          msg: 'userId must be a valid UUID'
        }
      }
    },

    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      set(value) {
        this.setDataValue('firstName', String(value || '').trim())
      },
      validate: {
        notEmpty: {
          msg: 'First name is required'
        },
        len: {
          args: [1, 100],
          msg: 'First name must be between 1 and 100 characters'
        }
      }
    },

    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      set(value) {
        this.setDataValue('lastName', normalizeText(value))
      }
    },

    headline: {
      type: DataTypes.STRING(255),
      allowNull: true,
      set(value) {
        this.setDataValue('headline', normalizeText(value))
      }
    },

    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
      set(value) {
        this.setDataValue('summary', normalizeText(value))
      }
    },

    skills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      set(value) {
        this.setDataValue('skills', normalizeStringArray(value))
      }
    },

    experience: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },

    education: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },

    currentLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
      set(value) {
        this.setDataValue('currentLocation', normalizeText(value))
      }
    },

    expectedSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Expected salary cannot be negative'
        }
      }
    },

    yearsOfExperience: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Years of experience cannot be negative'
        },
        max: {
          args: [99.9],
          msg: 'Years of experience cannot exceed 99.9'
        }
      }
    },

    resumeUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      set(value) {
        this.setDataValue('resumeUrl', normalizeText(value))
      }
    },

    isResumePublic: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },

    industry: {
      type: DataTypes.STRING(150),
      allowNull: true,
      set(value) {
        this.setDataValue('industry', normalizeText(value))
      }
    },

    profileCompleteness: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      validate: {
        isInt: {
          msg: 'Profile completeness must be an integer'
        },
        min: {
          args: [0],
          msg: 'Profile completeness cannot be less than 0'
        },
        max: {
          args: [100],
          msg: 'Profile completeness cannot exceed 100'
        }
      }
    }
  },
  {
    // Keep the existing table name used by the original schema.
    tableName: 'candidateprofiles',
    timestamps: true,
    hooks: {
      beforeValidate(profile) {
        if (!Array.isArray(profile.skills)) profile.skills = []
        if (!Array.isArray(profile.experience)) profile.experience = []
        if (!Array.isArray(profile.education)) profile.education = []

        if (
          profile.profileCompleteness !== null &&
          profile.profileCompleteness !== undefined
        ) {
          profile.profileCompleteness = Math.min(
            100,
            Math.max(0, Number(profile.profileCompleteness) || 0)
          )
        }
      }
    }
  }
)

module.exports = CandidateProfile