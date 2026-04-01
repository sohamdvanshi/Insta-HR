const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define(
  'Payment',
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
    orderId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    paymentId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'INR'
    },
    plan: {
      type: DataTypes.ENUM('standard', 'premium', 'enterprise'),
      allowNull: false
    },
    planName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('created', 'success', 'failed'),
      defaultValue: 'created'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'Payments',
    timestamps: true
  }
);

module.exports = Payment;