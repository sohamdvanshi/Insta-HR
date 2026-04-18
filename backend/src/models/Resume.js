const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Resume = sequelize.define('Resume', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'My Resume'
  },
  template: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'classic'
  },
  targetJobTitle: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: ''
  },
  targetJobDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: ''
  },
  personalInfo: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      jobTitle: '',
      linkedin: '',
      github: '',
      website: ''
    }
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: ''
  },
  experience: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  education: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  projects: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  skills: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  certifications: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  languages: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'draft'
  }
}, {
  tableName: 'resumes',
  timestamps: true
})

module.exports = Resume