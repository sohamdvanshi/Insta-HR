const fs = require('fs');
const content = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Training = sequelize.define('Training', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.STRING },
  type: {
    type: DataTypes.ENUM('video', 'live'),
    defaultValue: 'video'
  },
  price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  isFree: { type: DataTypes.BOOLEAN, defaultValue: false },
  duration: { type: DataTypes.STRING },
  emoji: { type: DataTypes.STRING, defaultValue: '📚' },
  thumbnail: { type: DataTypes.STRING },
  thumbnailPublicId: { type: DataTypes.STRING },
  videoUrl: { type: DataTypes.STRING },
  videoPublicId: { type: DataTypes.STRING },
  liveLink: { type: DataTypes.STRING },
  liveSchedule: { type: DataTypes.DATE },
  curriculum: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  skills: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  enrollmentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 0 },
  providerId: { type: DataTypes.UUID },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
});

module.exports = Training;
`;
fs.writeFileSync('src/models/Training.js', content);
console.log('Training model updated!');