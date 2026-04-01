const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Training = sequelize.define(
  'Training',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('video', 'live'),
      defaultValue: 'video'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    isFree: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    duration: {
      type: DataTypes.STRING,
      allowNull: true
    },
    emoji: {
      type: DataTypes.STRING,
      defaultValue: '📚'
    },
    thumbnail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    thumbnailPublicId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    videoUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    videoPublicId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    liveLink: {
      type: DataTypes.STRING,
      allowNull: true
    },
    liveSchedule: {
      type: DataTypes.DATE,
      allowNull: true
    },
    curriculum: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    skills: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    enrollmentCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    }
  },
  {
    tableName: 'Trainings',
    timestamps: true
  }
);

module.exports = Training;