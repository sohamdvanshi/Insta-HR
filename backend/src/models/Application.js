const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Application = sequelize.define(
  'Application',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    candidateId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(
        'applied',
        'shortlisted',
        'interview',
        'rejected',
        'hired'
      ),
      defaultValue: 'applied'
    },
    coverLetter: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    interviewDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    interviewMode: {
      type: DataTypes.ENUM('online', 'offline'),
      allowNull: true
    },
    interviewMeetingLink: {
      type: DataTypes.STRING,
      allowNull: true
    },
    interviewLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    interviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    interviewStatus: {
      type: DataTypes.ENUM('scheduled', 'completed', 'cancelled', 'rescheduled'),
      allowNull: true
    },
    interviewScheduledBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    resumeUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resumeFilename: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resumeText: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    aiScore: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    aiStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    aiSummary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    matchedSkills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    missingSkills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    aiRawResponse: {
      type: DataTypes.JSON,
      allowNull: true
    },
    screenedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    manualReviewStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'sent_to_employer'),
      allowNull: false,
      defaultValue: 'pending'
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'applications',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['jobId', 'candidateId']
      }
    ]
  }
);

module.exports = Application;