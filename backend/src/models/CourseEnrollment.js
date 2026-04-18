const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseEnrollment = sequelize.define(
  'CourseEnrollment',
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
    enrolledAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    status: {
      type: DataTypes.ENUM('active', 'cancelled', 'completed'),
      defaultValue: 'active'
    }
  },
  {
    tableName: 'course_enrollments',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'trainingId']
      }
    ]
  }
);

module.exports = CourseEnrollment;