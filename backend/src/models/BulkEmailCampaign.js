const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BulkEmailCampaign = sequelize.define(
  'BulkEmailCampaign',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    employerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    recipientCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    sentCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    failedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('draft', 'sending', 'sent', 'failed'),
      defaultValue: 'draft'
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'BulkEmailCampaigns',
    timestamps: true
  }
);

module.exports = BulkEmailCampaign;