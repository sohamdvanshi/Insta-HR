const sequelize = require('../config/database');

const User = require('./User');
const CandidateProfile = require('./CandidateProfile');
const Job = require('./Job');
const Application = require('./Application');
const Training = require('./Training');
const EmployerProfile = require('./EmployerProfile');
const Payment = require('./Payment');
const SavedJob = require('./SavedJob');
const JobAlert = require('./JobAlert');

User.hasOne(CandidateProfile, { foreignKey: 'userId', as: 'candidateProfile' });
CandidateProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Job, { foreignKey: 'employerId', as: 'jobs' });
Job.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

User.hasMany(Application, { foreignKey: 'candidateId', as: 'applications' });
Application.belongsTo(User, { foreignKey: 'candidateId', as: 'candidate' });

Job.hasMany(Application, { foreignKey: 'jobId', as: 'applications' });
Application.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

if (Training) {
  User.hasMany(Training, { foreignKey: 'providerId', as: 'trainings' });
  Training.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });
}

if (EmployerProfile) {
  User.hasOne(EmployerProfile, { foreignKey: 'userId', as: 'employerProfile' });
  EmployerProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });
}

if (Payment) {
  User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
  Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
}

if (SavedJob) {
  SavedJob.belongsTo(Job, { foreignKey: 'jobId', as: 'job', constraints: false });
  Job.hasMany(SavedJob, { foreignKey: 'jobId', as: 'savedJobs', constraints: false });

  SavedJob.belongsTo(User, { foreignKey: 'userId', as: 'user', constraints: false });
  User.hasMany(SavedJob, { foreignKey: 'userId', as: 'savedJobs', constraints: false });
}

if (JobAlert) {
  JobAlert.belongsTo(User, { foreignKey: 'userId', as: 'user', constraints: false });
  User.hasMany(JobAlert, { foreignKey: 'userId', as: 'jobAlerts', constraints: false });
}

const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ All tables created!');
  } catch (error) {
    console.error('❌ Table sync failed:', error.message);
  }
};

syncDatabase();

module.exports = {
  sequelize,
  User,
  CandidateProfile,
  Job,
  Application,
  Training,
  EmployerProfile,
  Payment,
  SavedJob,
  JobAlert
};