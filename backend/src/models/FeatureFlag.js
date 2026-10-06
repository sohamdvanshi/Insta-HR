const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('FeatureFlag', {
  key: { type: DataTypes.STRING(50), primaryKey: true },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: 'feature_flags', timestamps: true });
