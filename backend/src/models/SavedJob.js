const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SavedJob = sequelize.define(
  'SavedJob',
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
    jobId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  },
  {
    tableName: 'SavedJobs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'jobId']
      }
    ]
  }
);

module.exports = SavedJob;