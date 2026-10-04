const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('TrainingBatch', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  trainingId: { type: DataTypes.UUID, allowNull: false },
  trainerId: { type: DataTypes.UUID, allowNull: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'active', allowNull: false }
}, { tableName: 'training_batches', timestamps: true });
