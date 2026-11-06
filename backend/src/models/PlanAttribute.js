const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('PlanAttribute', {
 key: { type: DataTypes.STRING(50), primaryKey: true },
 label: { type: DataTypes.STRING(100), allowNull: false },
 type: { type: DataTypes.STRING(10), allowNull: false },
 unit: { type: DataTypes.STRING(30), allowNull: false, defaultValue: '' },
 defaultValue: { type: DataTypes.JSONB, allowNull: true }
}, { tableName: 'plan_attributes', timestamps: true });
