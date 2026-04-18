// Patch: fixes SavedJob model and index.js associations (constraints: false)
// Run from backend/: node scripts/patches/fix-savedjobs-model.js
const fs = require('fs');
const path = require('path');
const srcBase = path.join(__dirname, '../../src');

const savedJobModel = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const SavedJob = sequelize.define('SavedJob', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  jobId: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'SavedJobs', timestamps: true });
module.exports = SavedJob;
`;
fs.writeFileSync(path.join(srcBase,'models/SavedJob.js'), savedJobModel);
console.log('✅ SavedJob model fixed');

let idx = fs.readFileSync(path.join(srcBase,'models/index.js'), 'utf8');
idx = idx.replace(`SavedJob.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });\nJob.hasMany(SavedJob, { foreignKey: 'jobId' });\n\n`, '');
if (!idx.includes('SavedJob.belongsTo')) {
  idx = idx.replace('module.exports = {', `SavedJob.belongsTo(Job, { foreignKey: 'jobId', as: 'job', constraints: false });\nJob.hasMany(SavedJob, { foreignKey: 'jobId', constraints: false });\n\nmodule.exports = {`);
}
fs.writeFileSync(path.join(srcBase,'models/index.js'), idx);
console.log('✅ index.js associations fixed');
console.log('\nNow run: node scripts/db/fix-savedjobs-tables.js && npm run dev');
