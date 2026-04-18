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
const CourseProgress = require('./CourseProgress');
const CourseEnrollment = require('./CourseEnrollment');
const CourseQuiz = require('./CourseQuiz');
const CourseQuizQuestion = require('./CourseQuizQuestion');
const CourseQuizAttempt = require('./CourseQuizAttempt');
const Resume = require('./Resume');
const BulkEmailCampaign = require('./BulkEmailCampaign');
const ManpowerRequest = require('./manpowerRequest');
const Deployment = require('./Deployment');
const Contract = require('./Contract');
const Attendance = require('./Attendance');
const Payroll = require('./Payroll');
const Invoice = require('./Invoice');
const AuditLog = require('./AuditLog');
const FraudAlert = require('./FraudAlert');

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

if (CourseProgress) {
  User.hasMany(CourseProgress, { foreignKey: 'userId', as: 'courseProgress' });
  CourseProgress.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Training.hasMany(CourseProgress, { foreignKey: 'trainingId', as: 'progressRecords' });
  CourseProgress.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
}

if (CourseEnrollment) {
  User.hasMany(CourseEnrollment, { foreignKey: 'userId', as: 'courseEnrollments' });
  CourseEnrollment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Training.hasMany(CourseEnrollment, { foreignKey: 'trainingId', as: 'enrollments' });
  CourseEnrollment.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
}

if (CourseQuiz) {
  Training.hasOne(CourseQuiz, { foreignKey: 'trainingId', as: 'quiz' });
  CourseQuiz.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
}

if (CourseQuizQuestion) {
  CourseQuiz.hasMany(CourseQuizQuestion, {
    foreignKey: 'quizId',
    as: 'questions',
    onDelete: 'CASCADE'
  });
  CourseQuizQuestion.belongsTo(CourseQuiz, {
    foreignKey: 'quizId',
    as: 'quiz'
  });
}

if (CourseQuizAttempt) {
  User.hasMany(CourseQuizAttempt, { foreignKey: 'userId', as: 'quizAttempts' });
  CourseQuizAttempt.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Training.hasMany(CourseQuizAttempt, { foreignKey: 'trainingId', as: 'quizAttempts' });
  CourseQuizAttempt.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });

  CourseQuiz.hasMany(CourseQuizAttempt, { foreignKey: 'quizId', as: 'attempts' });
  CourseQuizAttempt.belongsTo(CourseQuiz, { foreignKey: 'quizId', as: 'quiz' });
}

if (Resume) {
  User.hasMany(Resume, { foreignKey: 'userId', as: 'resumes' });
  Resume.belongsTo(User, { foreignKey: 'userId', as: 'user' });
}

if (BulkEmailCampaign) {
  User.hasMany(BulkEmailCampaign, { foreignKey: 'employerId', as: 'bulkEmailCampaigns' });
  BulkEmailCampaign.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

  Job.hasMany(BulkEmailCampaign, { foreignKey: 'jobId', as: 'bulkEmailCampaigns' });
  BulkEmailCampaign.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });
}

if (ManpowerRequest) {
  User.hasMany(ManpowerRequest, { foreignKey: 'employerId', as: 'manpowerRequests' });
  ManpowerRequest.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });
}

if (Deployment) {
  User.hasMany(Deployment, { foreignKey: 'employerId', as: 'deployments' });
  Deployment.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

  User.hasMany(Deployment, { foreignKey: 'candidateId', as: 'candidateDeployments' });
  Deployment.belongsTo(User, { foreignKey: 'candidateId', as: 'candidate' });

  if (ManpowerRequest) {
    ManpowerRequest.hasMany(Deployment, { foreignKey: 'manpowerRequestId', as: 'deployments' });
    Deployment.belongsTo(ManpowerRequest, { foreignKey: 'manpowerRequestId', as: 'manpowerRequest' });
  }
}

if (Contract) {
  User.hasMany(Contract, { foreignKey: 'employerId', as: 'contracts' });
  Contract.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

  if (Deployment) {
    Deployment.hasMany(Contract, { foreignKey: 'deploymentId', as: 'contracts' });
    Contract.belongsTo(Deployment, { foreignKey: 'deploymentId', as: 'deployment' });
  }
}

if (Attendance) {
  User.hasMany(Attendance, { foreignKey: 'employerId', as: 'attendanceRecords' });
  Attendance.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

  User.hasMany(Attendance, { foreignKey: 'candidateId', as: 'candidateAttendance' });
  Attendance.belongsTo(User, { foreignKey: 'candidateId', as: 'candidate' });

  if (Deployment) {
    Deployment.hasMany(Attendance, { foreignKey: 'deploymentId', as: 'attendanceRecords' });
    Attendance.belongsTo(Deployment, { foreignKey: 'deploymentId', as: 'deployment' });
  }
}

if (Payroll) {
  User.hasMany(Payroll, { foreignKey: 'employerId', as: 'payrolls' });
  Payroll.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

  User.hasMany(Payroll, { foreignKey: 'candidateId', as: 'candidatePayrolls' });
  Payroll.belongsTo(User, { foreignKey: 'candidateId', as: 'candidate' });

  if (Deployment) {
    Deployment.hasMany(Payroll, { foreignKey: 'deploymentId', as: 'payrolls' });
    Payroll.belongsTo(Deployment, { foreignKey: 'deploymentId', as: 'deployment' });
  }
}

if (Invoice) {
  User.hasMany(Invoice, { foreignKey: 'employerId', as: 'invoices' });
  Invoice.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

  User.hasMany(Invoice, { foreignKey: 'candidateId', as: 'candidateInvoices' });
  Invoice.belongsTo(User, { foreignKey: 'candidateId', as: 'candidate' });

  if (Deployment) {
    Deployment.hasMany(Invoice, { foreignKey: 'deploymentId', as: 'invoices' });
    Invoice.belongsTo(Deployment, { foreignKey: 'deploymentId', as: 'deployment' });
  }

  if (Payroll) {
    Payroll.hasMany(Invoice, { foreignKey: 'payrollId', as: 'invoices' });
    Invoice.belongsTo(Payroll, { foreignKey: 'payrollId', as: 'payroll' });
  }
}

if (FraudAlert) {
  Application.hasMany(FraudAlert, {
    foreignKey: 'applicationId',
    as: 'fraudAlerts',
  });

  FraudAlert.belongsTo(Application, {
    foreignKey: 'applicationId',
    as: 'application',
  });

  User.hasMany(FraudAlert, {
    foreignKey: 'candidateId',
    as: 'fraudAlerts',
  });

  FraudAlert.belongsTo(User, {
    foreignKey: 'candidateId',
    as: 'candidate',
  });

  User.hasMany(FraudAlert, {
    foreignKey: 'reviewedBy',
    as: 'reviewedFraudAlerts',
  });

  FraudAlert.belongsTo(User, {
    foreignKey: 'reviewedBy',
    as: 'reviewer',
  });
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
  JobAlert,
  CourseProgress,
  CourseEnrollment,
  CourseQuiz,
  CourseQuizQuestion,
  CourseQuizAttempt,
  Resume,
  BulkEmailCampaign,
  ManpowerRequest,
  Deployment,
  Contract,
  Attendance,
  Payroll,
  Invoice,
  AuditLog,
  FraudAlert
};