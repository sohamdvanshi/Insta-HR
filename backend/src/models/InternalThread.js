const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const InternalThread = sequelize.define(
  'InternalThread',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'general',
      validate: {
        isIn: [[
          'general',
          'candidate',
          'employer',
          'job',
          'application',
          'payment',
          'payroll',
          'referral',
          'fraud'
        ]]
      }
    },
    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'normal',
      validate: {
        isIn: [['low', 'normal', 'high', 'urgent']]
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
      validate: {
        isIn: [['open', 'in_progress', 'resolved', 'closed']]
      }
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false
    },
    assignedTo: {
      type: DataTypes.UUID,
      allowNull: true
    },
    relatedEntityType: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    relatedEntityId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  },
  {
    tableName: 'internal_threads',
    timestamps: true
  }
)

module.exports = InternalThread
