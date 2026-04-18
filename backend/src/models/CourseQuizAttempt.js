const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseQuizAttempt = sequelize.define(
  'CourseQuizAttempt',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    trainingId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    totalMarks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    passed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    answers: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    attemptedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'CourseQuizAttempts',
    timestamps: true
  }
);

module.exports = CourseQuizAttempt;