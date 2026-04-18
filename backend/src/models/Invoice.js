const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define(
  'Invoice',
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
    payrollId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    invoiceNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    billingPeriodMonth: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    paymentTerms: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Net 30',
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'invoices',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['deploymentId', 'billingPeriodMonth'],
      },
    ],
  }
);

module.exports = Invoice;