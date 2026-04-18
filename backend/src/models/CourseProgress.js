const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseProgress = sequelize.define(
  'CourseProgress',
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
    trainingId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    progressPercent: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastWatchedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    watchTimeSeconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  },
  {
    tableName: 'course_progress',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'trainingId']
      }
    ]
  }
);

module.exports = CourseProgress;