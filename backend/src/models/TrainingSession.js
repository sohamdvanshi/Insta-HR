const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('TrainingSession', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  trainingId: { type: DataTypes.UUID, allowNull: false },
  batchId: { type: DataTypes.UUID, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  mode: { type: DataTypes.STRING(20), allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: false },
  endsAt: { type: DataTypes.DATE, allowNull: false },
  location: { type: DataTypes.TEXT, allowNull: true },
  meetingUrl: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(20), defaultValue: 'scheduled', allowNull: false },
  notificationLog: { type: DataTypes.JSON, defaultValue: {} }
}, { tableName: 'training_sessions', timestamps: true });
