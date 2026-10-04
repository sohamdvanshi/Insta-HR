const sequelize = require('../config/database')

const User = require('./User')
const CandidateProfile = require('./CandidateProfile')
const Job = require('./Job')
const Application = require('./Application')
const Training = require('./Training')
const TrainingBatch = require('./TrainingBatch')
const TrainingSession = require('./TrainingSession')
const TrainingAttendance = require('./TrainingAttendance')
const EmployerProfile = require('./EmployerProfile')
const Payment = require('./Payment')
const SavedJob = require('./SavedJob')
const JobAlert = require('./JobAlert')
const CourseProgress = require('./CourseProgress')
const CourseEnrollment = require('./CourseEnrollment')
const CourseQuiz = require('./CourseQuiz')
const CourseQuizQuestion = require('./CourseQuizQuestion')
const CourseQuizAttempt = require('./CourseQuizAttempt')
const Resume = require('./Resume')
const BulkEmailCampaign = require('./BulkEmailCampaign')
const ManpowerRequest = require('./manpowerRequest')
const Deployment = require('./Deployment')
const Contract = require('./Contract')
const Attendance = require('./Attendance')
const Payroll = require('./Payroll')
const Invoice = require('./Invoice')
const AuditLog = require('./AuditLog')
const FraudAlert = require('./FraudAlert')
const LoyaltyPointTransaction = require('./LoyaltyPointTransaction')
const InternalThread = require('./InternalThread')
const InternalMessage = require('./InternalMessage')
const InternalNote = require('./InternalNote')

const optionalModel = (model) => model && typeof model.hasMany === 'function'

/* User and candidate profile */
User.hasOne(CandidateProfile, {
  foreignKey: 'userId',
  as: 'candidateProfile',
  constraints: false
})

CandidateProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  constraints: false
})

/* Jobs */
User.hasMany(Job, {
  foreignKey: 'employerId',
  as: 'jobs',
  constraints: false
})

Job.belongsTo(User, {
  foreignKey: 'employerId',
  as: 'employer',
  constraints: false
})

/* Applications */
User.hasMany(Application, {
  foreignKey: 'candidateId',
  as: 'applications',
  constraints: false
})

Application.belongsTo(User, {
  foreignKey: 'candidateId',
  as: 'candidate',
  constraints: false
})

Job.hasMany(Application, {
  foreignKey: 'jobId',
  as: 'applications',
  constraints: false
})

Application.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job',
  constraints: false
})

/* Referrals */
User.hasMany(Application, {
  foreignKey: 'referredByUserId',
  as: 'referralsGiven',
  constraints: false
})

Application.belongsTo(User, {
  foreignKey: 'referredByUserId',
  as: 'referrer',
  constraints: false
})

/* Loyalty points */
if (optionalModel(LoyaltyPointTransaction)) {
  LoyaltyPointTransaction.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })

  User.hasMany(LoyaltyPointTransaction, {
    foreignKey: 'userId',
    as: 'loyaltyPointTransactions',
    constraints: false
  })

  LoyaltyPointTransaction.belongsTo(Application, {
    foreignKey: 'applicationId',
    as: 'application',
    constraints: false
  })

  Application.hasMany(LoyaltyPointTransaction, {
    foreignKey: 'applicationId',
    as: 'loyaltyPointTransactions',
    constraints: false
  })
}

/* Training */
if (optionalModel(Training)) {
  User.hasMany(Training, {
    foreignKey: 'providerId',
    as: 'trainings',
    constraints: false
  })

  Training.belongsTo(User, {
    foreignKey: 'providerId',
    as: 'provider',
    constraints: false
  })
}


/* Training batches, sessions, and trainee attendance */
TrainingBatch.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' })
TrainingBatch.belongsTo(User, { foreignKey: 'trainerId', as: 'trainer' })
TrainingSession.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' })
TrainingSession.belongsTo(TrainingBatch, { foreignKey: 'batchId', as: 'batch' })
TrainingAttendance.belongsTo(User, { foreignKey: 'userId', as: 'student' })
TrainingAttendance.belongsTo(TrainingSession, { foreignKey: 'sessionId', as: 'session' })
CourseEnrollment.belongsTo(TrainingBatch, { foreignKey: 'batchId', as: 'batch' })

/* Employer profile */
if (optionalModel(EmployerProfile)) {
  User.hasOne(EmployerProfile, {
    foreignKey: 'userId',
    as: 'employerProfile',
    constraints: false
  })

  EmployerProfile.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })
}

/* Payments */
if (optionalModel(Payment)) {
  User.hasMany(Payment, {
    foreignKey: 'userId',
    as: 'payments',
    constraints: false
  })

  Payment.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })
}

/* Saved jobs */
if (optionalModel(SavedJob)) {
  SavedJob.belongsTo(Job, {
    foreignKey: 'jobId',
    as: 'job',
    constraints: false
  })

  Job.hasMany(SavedJob, {
    foreignKey: 'jobId',
    as: 'savedJobs',
    constraints: false
  })

  SavedJob.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })

  User.hasMany(SavedJob, {
    foreignKey: 'userId',
    as: 'savedJobs',
    constraints: false
  })
}

/* Job alerts */
if (optionalModel(JobAlert)) {
  JobAlert.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })

  User.hasMany(JobAlert, {
    foreignKey: 'userId',
    as: 'jobAlerts',
    constraints: false
  })
}

/* Course progress */
if (optionalModel(CourseProgress) && optionalModel(Training)) {
  User.hasMany(CourseProgress, {
    foreignKey: 'userId',
    as: 'courseProgress',
    constraints: false
  })

  CourseProgress.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })

  Training.hasMany(CourseProgress, {
    foreignKey: 'trainingId',
    as: 'progressRecords',
    constraints: false
  })

  CourseProgress.belongsTo(Training, {
    foreignKey: 'trainingId',
    as: 'training',
    constraints: false
  })
}

/* Course enrollments */
if (optionalModel(CourseEnrollment) && optionalModel(Training)) {
  User.hasMany(CourseEnrollment, {
    foreignKey: 'userId',
    as: 'courseEnrollments',
    constraints: false
  })

  CourseEnrollment.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })

  Training.hasMany(CourseEnrollment, {
    foreignKey: 'trainingId',
    as: 'enrollments',
    constraints: false
  })

  CourseEnrollment.belongsTo(Training, {
    foreignKey: 'trainingId',
    as: 'training',
    constraints: false
  })
}

/* Course quizzes */
if (optionalModel(CourseQuiz) && optionalModel(Training)) {
  Training.hasOne(CourseQuiz, {
    foreignKey: 'trainingId',
    as: 'quiz',
    constraints: false
  })

  CourseQuiz.belongsTo(Training, {
    foreignKey: 'trainingId',
    as: 'training',
    constraints: false
  })
}

if (optionalModel(CourseQuizQuestion) && optionalModel(CourseQuiz)) {
  CourseQuiz.hasMany(CourseQuizQuestion, {
    foreignKey: 'quizId',
    as: 'questions',
    constraints: false
  })

  CourseQuizQuestion.belongsTo(CourseQuiz, {
    foreignKey: 'quizId',
    as: 'quiz',
    constraints: false
  })
}

if (
  optionalModel(CourseQuizAttempt) &&
  optionalModel(Training) &&
  optionalModel(CourseQuiz)
) {
  User.hasMany(CourseQuizAttempt, {
    foreignKey: 'userId',
    as: 'quizAttempts',
    constraints: false
  })

  CourseQuizAttempt.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })

  Training.hasMany(CourseQuizAttempt, {
    foreignKey: 'trainingId',
    as: 'quizAttempts',
    constraints: false
  })

  CourseQuizAttempt.belongsTo(Training, {
    foreignKey: 'trainingId',
    as: 'training',
    constraints: false
  })

  CourseQuiz.hasMany(CourseQuizAttempt, {
    foreignKey: 'quizId',
    as: 'attempts',
    constraints: false
  })

  CourseQuizAttempt.belongsTo(CourseQuiz, {
    foreignKey: 'quizId',
    as: 'quiz',
    constraints: false
  })
}

/* Resume */
if (optionalModel(Resume)) {
  User.hasMany(Resume, {
    foreignKey: 'userId',
    as: 'resumes',
    constraints: false
  })

  Resume.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    constraints: false
  })
}

/* Bulk email campaigns */
if (optionalModel(BulkEmailCampaign)) {
  User.hasMany(BulkEmailCampaign, {
    foreignKey: 'employerId',
    as: 'bulkEmailCampaigns',
    constraints: false
  })

  BulkEmailCampaign.belongsTo(User, {
    foreignKey: 'employerId',
    as: 'employer',
    constraints: false
  })

  Job.hasMany(BulkEmailCampaign, {
    foreignKey: 'jobId',
    as: 'bulkEmailCampaigns',
    constraints: false
  })

  BulkEmailCampaign.belongsTo(Job, {
    foreignKey: 'jobId',
    as: 'job',
    constraints: false
  })
}

/* Manpower requests */
if (optionalModel(ManpowerRequest)) {
  User.hasMany(ManpowerRequest, {
    foreignKey: 'employerId',
    as: 'manpowerRequests',
    constraints: false
  })

  ManpowerRequest.belongsTo(User, {
    foreignKey: 'employerId',
    as: 'employer',
    constraints: false
  })
}

/* Deployments */
if (optionalModel(Deployment)) {
  User.hasMany(Deployment, {
    foreignKey: 'employerId',
    as: 'deployments',
    constraints: false
  })

  Deployment.belongsTo(User, {
    foreignKey: 'employerId',
    as: 'employer',
    constraints: false
  })

  User.hasMany(Deployment, {
    foreignKey: 'candidateId',
    as: 'candidateDeployments',
    constraints: false
  })

  Deployment.belongsTo(User, {
    foreignKey: 'candidateId',
    as: 'candidate',
    constraints: false
  })

  if (optionalModel(ManpowerRequest)) {
    ManpowerRequest.hasMany(Deployment, {
      foreignKey: 'manpowerRequestId',
      as: 'deployments',
      constraints: false
    })

    Deployment.belongsTo(ManpowerRequest, {
      foreignKey: 'manpowerRequestId',
      as: 'manpowerRequest',
      constraints: false
    })
  }
}

/* Contracts */
if (optionalModel(Contract)) {
  User.hasMany(Contract, {
    foreignKey: 'employerId',
    as: 'contracts',
    constraints: false
  })

  Contract.belongsTo(User, {
    foreignKey: 'employerId',
    as: 'employer',
    constraints: false
  })

  if (optionalModel(Deployment)) {
    Deployment.hasMany(Contract, {
      foreignKey: 'deploymentId',
      as: 'contracts',
      constraints: false
    })

    Contract.belongsTo(Deployment, {
      foreignKey: 'deploymentId',
      as: 'deployment',
      constraints: false
    })
  }
}

/* Attendance */
if (optionalModel(Attendance)) {
  User.hasMany(Attendance, {
    foreignKey: 'employerId',
    as: 'attendanceRecords',
    constraints: false
  })

  Attendance.belongsTo(User, {
    foreignKey: 'employerId',
    as: 'employer',
    constraints: false
  })

  User.hasMany(Attendance, {
    foreignKey: 'candidateId',
    as: 'candidateAttendance',
    constraints: false
  })

  Attendance.belongsTo(User, {
    foreignKey: 'candidateId',
    as: 'candidate',
    constraints: false
  })

  if (optionalModel(Deployment)) {
    Deployment.hasMany(Attendance, {
      foreignKey: 'deploymentId',
      as: 'attendanceRecords',
      constraints: false
    })

    Attendance.belongsTo(Deployment, {
      foreignKey: 'deploymentId',
      as: 'deployment',
      constraints: false
    })
  }
}

/* Payroll */
if (optionalModel(Payroll)) {
  User.hasMany(Payroll, {
    foreignKey: 'employerId',
    as: 'payrolls',
    constraints: false
  })

  Payroll.belongsTo(User, {
    foreignKey: 'employerId',
    as: 'employer',
    constraints: false
  })

  User.hasMany(Payroll, {
    foreignKey: 'candidateId',
    as: 'candidatePayrolls',
    constraints: false
  })

  Payroll.belongsTo(User, {
    foreignKey: 'candidateId',
    as: 'candidate',
    constraints: false
  })

  if (optionalModel(Deployment)) {
    Deployment.hasMany(Payroll, {
      foreignKey: 'deploymentId',
      as: 'payrolls',
      constraints: false
    })

    Payroll.belongsTo(Deployment, {
      foreignKey: 'deploymentId',
      as: 'deployment',
      constraints: false
    })
  }
}

/* Invoices */
if (optionalModel(Invoice)) {
  User.hasMany(Invoice, {
    foreignKey: 'employerId',
    as: 'invoices',
    constraints: false
  })

  Invoice.belongsTo(User, {
    foreignKey: 'employerId',
    as: 'employer',
    constraints: false
  })

  User.hasMany(Invoice, {
    foreignKey: 'candidateId',
    as: 'candidateInvoices',
    constraints: false
  })

  Invoice.belongsTo(User, {
    foreignKey: 'candidateId',
    as: 'candidate',
    constraints: false
  })

  if (optionalModel(Deployment)) {
    Deployment.hasMany(Invoice, {
      foreignKey: 'deploymentId',
      as: 'invoices',
      constraints: false
    })

    Invoice.belongsTo(Deployment, {
      foreignKey: 'deploymentId',
      as: 'deployment',
      constraints: false
    })
  }

  if (optionalModel(Payroll)) {
    Payroll.hasMany(Invoice, {
      foreignKey: 'payrollId',
      as: 'invoices',
      constraints: false
    })

    Invoice.belongsTo(Payroll, {
      foreignKey: 'payrollId',
      as: 'payroll',
      constraints: false
    })
  }
}

/* Fraud alerts */
if (optionalModel(FraudAlert)) {
  Application.hasMany(FraudAlert, {
    foreignKey: 'applicationId',
    as: 'fraudAlerts',
    constraints: false
  })

  FraudAlert.belongsTo(Application, {
    foreignKey: 'applicationId',
    as: 'application',
    constraints: false
  })

  User.hasMany(FraudAlert, {
    foreignKey: 'candidateId',
    as: 'fraudAlerts',
    constraints: false
  })

  FraudAlert.belongsTo(User, {
    foreignKey: 'candidateId',
    as: 'candidate',
    constraints: false
  })

  User.hasMany(FraudAlert, {
    foreignKey: 'reviewedBy',
    as: 'reviewedFraudAlerts',
    constraints: false
  })

  FraudAlert.belongsTo(User, {
    foreignKey: 'reviewedBy',
    as: 'reviewer',
    constraints: false
  })
}

/* Internal communication */

User.hasMany(InternalThread, {
  foreignKey: 'createdBy',
  as: 'createdInternalThreads',
  constraints: false
})

InternalThread.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
  constraints: false
})

User.hasMany(InternalThread, {
  foreignKey: 'assignedTo',
  as: 'assignedInternalThreads',
  constraints: false
})

InternalThread.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignee',
  constraints: false
})

InternalThread.hasMany(InternalMessage, {
  foreignKey: 'threadId',
  as: 'messages',
  constraints: false
})

InternalMessage.belongsTo(InternalThread, {
  foreignKey: 'threadId',
  as: 'thread',
  constraints: false
})

User.hasMany(InternalMessage, {
  foreignKey: 'senderId',
  as: 'internalMessages',
  constraints: false
})

InternalMessage.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
  constraints: false
})

User.hasMany(InternalNote, {
  foreignKey: 'authorId',
  as: 'internalNotes',
  constraints: false
})

InternalNote.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author',
  constraints: false
})


const syncDatabase = async () => {
  try {
    console.log('🔄 Synchronizing database schema...')

    await sequelize.authenticate()

    await sequelize.sync({
      alter: {
        drop: false
      }
    })

    console.log('✅ Database schema synchronized successfully.')

    return true
  } catch (error) {
    console.error('❌ Database schema synchronization failed:')
    console.error(error)

    return false
  }
}

// Schema changes are applied explicitly with migration scripts.

module.exports = {
  sequelize,
  User,
  CandidateProfile,
  Job,
  Application,
  Training,
  TrainingBatch,
  TrainingSession,
  TrainingAttendance,
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
  FraudAlert,
  LoyaltyPointTransaction,
  InternalThread,
  InternalMessage,
  InternalNote,
  syncDatabase
}