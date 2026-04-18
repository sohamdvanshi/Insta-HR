const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Deployment = sequelize.define(
  'Deployment',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    manpowerRequestId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    candidateId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    siteName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reportingManager: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    shiftType: {
      type: DataTypes.ENUM('general', 'day', 'night', 'rotational'),
      allowNull: false,
      defaultValue: 'general',
    },
    status: {
      type: DataTypes.ENUM('assigned', 'active', 'completed', 'cancelled', 'on_hold'),
      allowNull: false,
      defaultValue: 'assigned',
    },
    salaryOffered: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingRate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'deployments',
    timestamps: true,
  }
);

module.exports = Deployment;