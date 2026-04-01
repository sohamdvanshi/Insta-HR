const fs = require('fs');

// Fix SavedJob model - remove indexes that cause FK issues
const savedJobModel = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SavedJob = sequelize.define('SavedJob', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  jobId: { type: DataTypes.INTEGER, allowNull: false },
}, { 
  tableName: 'SavedJobs', 
  timestamps: true,
});

module.exports = SavedJob;
`;
fs.writeFileSync('src/models/SavedJob.js', savedJobModel);
console.log('✅ SavedJob model fixed');

// Fix index.js - remove the association that causes FK constraint
let idx = fs.readFileSync('src/models/index.js', 'utf8');

// Remove the problematic association lines if they exist
idx = idx.replace(
  `SavedJob.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });
Job.hasMany(SavedJob, { foreignKey: 'jobId' });

`,
  ''
);

// Add associations AFTER all models are defined, just before module.exports
if (!idx.includes("SavedJob.belongsTo")) {
  idx = idx.replace(
    'module.exports = {',
    `// Associations (defined after all models loaded)
SavedJob.belongsTo(Job, { foreignKey: 'jobId', as: 'job', constraints: false });
Job.hasMany(SavedJob, { foreignKey: 'jobId', constraints: false });

module.exports = {`
  );
}

fs.writeFileSync('src/models/index.js', idx);
console.log('✅ index.js associations fixed (constraints: false)');
console.log('\nNow run:');
console.log('  node fix-savedjobs-tables.js');
console.log('  npm run dev');