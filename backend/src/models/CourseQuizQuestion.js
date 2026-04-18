const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseQuizQuestion = sequelize.define(
  'CourseQuizQuestion',
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
    question: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    optionA: {
      type: DataTypes.STRING,
      allowNull: false
    },
    optionB: {
      type: DataTypes.STRING,
      allowNull: false
    },
    optionC: {
      type: DataTypes.STRING,
      allowNull: false
    },
    optionD: {
      type: DataTypes.STRING,
      allowNull: false
    },
    correctOption: {
      type: DataTypes.ENUM('A', 'B', 'C', 'D'),
      allowNull: false
    },
    marks: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  },
  {
    tableName: 'CourseQuizQuestions',
    timestamps: true
  }
);

module.exports = CourseQuizQuestion;