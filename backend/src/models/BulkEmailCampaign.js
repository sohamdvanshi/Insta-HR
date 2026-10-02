const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const BulkEmailCampaign = sequelize.define('BulkEmailCampaign', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  employerId: { type: DataTypes.UUID, allowNull: false },
  jobId: { type: DataTypes.UUID, allowNull: false },
  subject: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  recipientStatus: { type: DataTypes.ENUM('applied', 'shortlisted', 'hired', 'rejected'), allowNull: false, defaultValue: 'shortlisted' },
  audience: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'applicants', validate: { isIn: [['applicants', 'referrers']] } },
  recipientCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  sentCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('draft', 'sending', 'sent', 'failed'), allowNull: false, defaultValue: 'draft' },
  sentAt: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'BulkEmailCampaigns', timestamps: true })
BulkEmailCampaign.RECIPIENT_STATUSES = ['applied', 'shortlisted', 'hired', 'rejected']
module.exports = BulkEmailCampaign
