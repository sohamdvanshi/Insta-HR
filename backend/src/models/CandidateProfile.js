const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CandidateProfile = sequelize.define(
  'CandidateProfile',
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
    firstName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    headline: {
      type: DataTypes.STRING,
      allowNull: true
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    skills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    experience: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    education: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    currentLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    expectedSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    yearsOfExperience: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true
    },
    resumeUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isResumePublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    industry: {
      type: DataTypes.STRING,
      allowNull: true
    },
    profileCompleteness: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  },
  {
    tableName: 'candidate_profiles',
    timestamps: true
  }
);

module.exports = CandidateProfile;