const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Job = sequelize.define(
  'Job',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    employerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    jobType: {
      type: DataTypes.ENUM('full-time', 'part-time', 'internship', 'contract', 'remote'),
      allowNull: false,
      defaultValue: 'full-time'
    },
    industry: {
      type: DataTypes.STRING,
      allowNull: true
    },
    salaryMin: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    salaryMax: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'INR'
    },
    experienceLevel: {
      type: DataTypes.ENUM('intern', 'junior', 'mid', 'senior'),
      allowNull: false,
      defaultValue: 'junior'
    },
    minExperienceYears: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    minimumEducation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    requiredSkills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    preferredSkills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    responsibilities: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    qualifications: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    benefits: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    applicationDeadline: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'closed'),
      allowNull: false,
      defaultValue: 'active'
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    featuredUntil: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'jobs',
    timestamps: true
  }
);

module.exports = Job;