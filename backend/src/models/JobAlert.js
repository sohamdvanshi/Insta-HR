const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobAlert = sequelize.define(
  'JobAlert',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    keywords: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    industry: {
      type: DataTypes.STRING,
      allowNull: true
    },
    jobType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastSentAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'JobAlerts',
    timestamps: true
  }
);

module.exports = JobAlert;