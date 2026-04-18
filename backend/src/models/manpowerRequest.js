const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ManpowerRequest = sequelize.define(
  'ManpowerRequest',
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
    jobTitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    headcountRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shiftType: {
      type: DataTypes.ENUM('day', 'night', 'rotational', 'general'),
      allowNull: false,
      defaultValue: 'general',
    },
    employmentType: {
      type: DataTypes.ENUM('contract', 'temporary', 'permanent', 'project'),
      allowNull: false,
      defaultValue: 'contract',
    },
    contractDuration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    salaryBudget: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingType: {
      type: DataTypes.ENUM('monthly', 'daily', 'hourly'),
      allowNull: false,
      defaultValue: 'monthly',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    skillsRequired: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    experienceRequired: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'fulfilled', 'closed', 'cancelled'),
      allowNull: false,
      defaultValue: 'open',
    },
  },
  {
    tableName: 'manpower_requests',
    timestamps: true,
  }
);

module.exports = ManpowerRequest;