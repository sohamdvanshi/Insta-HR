const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define(
  'Attendance',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    deploymentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    candidateId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    attendanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    checkInTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    checkOutTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('present', 'absent', 'half_day', 'leave', 'late'),
      allowNull: false,
      defaultValue: 'present',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'attendance',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['deploymentId', 'attendanceDate'],
      },
    ],
  }
);

module.exports = Attendance;