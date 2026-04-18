const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payroll = sequelize.define(
  'Payroll',
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
      allowNull: false,
    },
    candidateId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    payPeriodMonth: {
      type: DataTypes.STRING,
      allowNull: false, // example: 2026-04
    },
    totalPresentDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalAbsentDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalHalfDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    grossSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    deductions: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    bonus: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    netSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('draft', 'processed', 'paid'),
      allowNull: false,
      defaultValue: 'draft',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'payrolls',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['deploymentId', 'payPeriodMonth'],
      },
    ],
  }
);

module.exports = Payroll;