const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FraudAlert = sequelize.define(
  'FraudAlert',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    candidateId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    applicationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    ruleCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'low',
    },
    riskScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('open', 'reviewed', 'dismissed', 'confirmed'),
      allowNull: false,
      defaultValue: 'open',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'fraud_alerts',
    timestamps: true,
    indexes: [
      { fields: ['candidateId'] },
      { fields: ['applicationId'] },
      { fields: ['ruleCode'] },
      { fields: ['severity'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = FraudAlert;