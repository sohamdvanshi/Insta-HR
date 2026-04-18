const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseQuiz = sequelize.define(
  'CourseQuiz',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    trainingId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Final Course Quiz'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    passPercentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 70,
      validate: {
        min: 1,
        max: 100
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    tableName: 'CourseQuizzes',
    timestamps: true
  }
);

module.exports = CourseQuiz;