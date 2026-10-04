const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('TrainingAttendance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sessionId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  markedBy: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false },
  notes: { type: DataTypes.STRING(1000), defaultValue: '' }
}, { tableName: 'training_attendance', timestamps: true, indexes: [{ unique: true, fields: ['sessionId', 'userId'] }] });
