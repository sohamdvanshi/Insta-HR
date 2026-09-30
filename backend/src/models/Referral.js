const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Referral = sequelize.define(
  'Referral',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    referrerId: {
      type: DataTypes.UUID,
      allowNull: false
    },

    referredCandidateId: {
      type: DataTypes.UUID,
      allowNull: false
    },

    employerId: {
      type: DataTypes.UUID,
      allowNull: true
    },

    jobId: {
      type: DataTypes.UUID,
      allowNull: true
    },

    applicationId: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true
    },

    referralType: {
      type: DataTypes.ENUM('candidate', 'cv'),
      allowNull: false,
      defaultValue: 'candidate'
    },

    status: {
      type: DataTypes.ENUM(
        'pending',
        'verified',
        'shortlisted',
        'hired',
        'rejected',
        'cancelled',
        'paid'
      ),
      allowNull: false,
      defaultValue: 'pending'
    },

    bonusStatus: {
      type: DataTypes.ENUM(
        'not_eligible',
        'eligible',
        'paid',
        'reversed'
      ),
      allowNull: false,
      defaultValue: 'not_eligible'
    },

    pointsAwarded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    hiredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    paidAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'referrals',
    timestamps: true,
    indexes: [
      {
        fields: ['referrerId']
      },
      {
        fields: ['referredCandidateId']
      },
      {
        fields: ['employerId']
      },
      {
        fields: ['jobId']
      },
      {
        fields: ['applicationId']
      },
      {
        fields: ['status']
      }
    ]
  }
)

module.exports = Referral