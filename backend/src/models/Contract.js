const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contract = sequelize.define(
  'Contract',
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
    deploymentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    contractTitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contractType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'staffing',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    renewalDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    billingType: {
      type: DataTypes.ENUM('monthly', 'hourly', 'per_resource', 'fixed'),
      allowNull: false,
      defaultValue: 'monthly',
    },
    billingRate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'expired', 'renewed', 'terminated'),
      allowNull: false,
      defaultValue: 'draft',
    },
    documentUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'contracts',
    timestamps: true,
  }
);

module.exports = Contract;