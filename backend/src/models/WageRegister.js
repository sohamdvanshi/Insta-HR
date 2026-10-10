const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('WageRegister', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  employerId: { type: DataTypes.UUID, allowNull: false },
  period: { type: DataTypes.STRING(7), allowNull: false },
  site: { type: DataTypes.STRING(100), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  sourceHash: { type: DataTypes.STRING(64), allowNull: false },
  sourceName: { type: DataTypes.STRING(255), allowNull: false },
  rows: { type: DataTypes.JSONB, allowNull: false },
  warnings: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  approvedAt: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'wage_registers', indexes: [{ unique: true, fields: ['employerId','period','site'] }] });
