// Generator: creates SavedJob+JobAlert models, savedJobs controller+routes
// Run from backend/: node scripts/generators/savedjobs-backend.js
const fs = require('fs');
const path = require('path');
const srcBase = path.join(__dirname, '../../src');

const savedJobModel = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const SavedJob = sequelize.define('SavedJob', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  jobId: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'SavedJobs', timestamps: true, indexes: [{ unique: true, fields: ['userId','jobId'] }] });
module.exports = SavedJob;
`;
fs.writeFileSync(path.join(srcBase,'models/SavedJob.js'), savedJobModel);
console.log('✅ SavedJob model created');

const jobAlertModel = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const JobAlert = sequelize.define('JobAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  keywords: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  industry: { type: DataTypes.STRING },
  jobType: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastSentAt: { type: DataTypes.DATE },
}, { tableName: 'JobAlerts', timestamps: true });
module.exports = JobAlert;
`;
fs.writeFileSync(path.join(srcBase,'models/JobAlert.js'), jobAlertModel);
console.log('✅ JobAlert model created');
console.log('\n🎉 SavedJobs backend done! Now run: node scripts/db/fix-savedjobs-tables.js && npm run dev');
