const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('SubscriptionPlan', {
  id: { type: DataTypes.STRING(30), primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  amountPaise: { type: DataTypes.INTEGER, allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
  durationDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: 'subscription_plans', timestamps: true });
