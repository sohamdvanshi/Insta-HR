require('dotenv').config()

const express = require('express')
const rateLimit = require('express-rate-limit')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')
const fs = require('fs')
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

// Loads models and associations only. It does not synchronize or alter the DB.
require('./models/index')

const sequelize = require('./config/database')
const { createRedisConnection } = require('./config/redis')
const { connectElasticsearch } = require('./config/elasticsearch')
const { ensureJobsIndex } = require('./services/search/jobSearch.service')
const { startSubscriptionCron } = require('./cron/subscription.cron')

const authRoutes = require('./routes/auth.routes')
const candidateRoutes = require('./routes/candidate.routes')
const jobRoutes = require('./routes/job.routes')
const applicationRoutes = require('./routes/application.routes')
const trainingRoutes = require('./routes/training.routes')
const paymentRoutes = require('./routes/payment.routes')
const employerRoutes = require('./routes/employer.routes')
const adminRoutes = require('./routes/admin.routes')
const bulkEmailCampaignRoutes = require('./routes/bulkEmailCampaign.routes')
const manpowerRequestRoutes = require('./routes/manpowerRequest.routes')
const deploymentRoutes = require('./routes/deployment.routes')
const contractRoutes = require('./routes/contract.routes')
const attendanceRoutes = require('./routes/attendance.routes')
const payrollRoutes = require('./routes/payroll.routes')
const invoiceRoutes = require('./routes/invoice.routes')
const analyticsRoutes = require('./routes/analytics.routes')
const employerAnalyticsRoutes = require('./routes/employerAnalytics.routes')
const employerTrendsRoutes = require('./routes/employerTrends.routes')
const employerSegmentAnalyticsRoutes = require('./routes/employerSegmentAnalytics.routes')
const adminAuditRoutes = require('./routes/adminAudit.routes')
const referralRoutes = require('./routes/referral.routes')
const resumeRoutes = require('./routes/resume.routes')
const aiScreeningRoutes = require('./routes/aiScreening.routes')
const resumeAIRoutes = require('./routes/resumeAI.routes')
const savedJobsRoutes = require('./routes/savedJobs.routes')
const internalCommunicationRoutes = require('./routes/internalCommunication.routes')

const app = express()
const PORT = Number(process.env.PORT) || 5000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || `http://localhost:${PORT}`

const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, '../uploads')
)
const resumesDir = path.join(uploadsDir, 'resumes')

fs.mkdirSync(resumesDir, { recursive: true })

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: FRONTEND_URL, credentials: true }))

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  }
})

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'InstaHire API',
      version: '1.0.0',
      description: 'AI-Powered Job Portal API Documentation'
    },
    servers: [{
      url: API_URL,
      description: process.env.NODE_ENV === 'production'
        ? 'Production server'
        : 'Development server'
    }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: [path.join(__dirname, 'routes/*.js')]
})

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { background: linear-gradient(135deg, #2563eb, #9333ea); }',
  customSiteTitle: 'InstaHire API Docs'
}))

app.use('/api/', apiLimiter)
app.use('/api/v1/auth/login', authLimiter)
app.use('/api/v1/auth/register', authLimiter)
app.use(morgan('dev'))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

app.use('/uploads', express.static(uploadsDir, {
  fallthrough: true,
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600')
  }
}))

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/employers', employerRoutes)
app.use('/api/v1/candidates', candidateRoutes)
app.use('/api/v1/jobs', jobRoutes)
app.use('/api/v1/applications', applicationRoutes)
app.use('/api/v1/referrals', referralRoutes)
app.use('/api/v1/training', trainingRoutes)
app.use('/api/v1/resumes', resumeRoutes)
app.use('/api/v1/ai', aiScreeningRoutes)
app.use('/api/v1/ai', resumeAIRoutes)
app.use('/api/v1/jobs-actions', savedJobsRoutes)
app.use('/api/v1/payments', paymentRoutes)
app.use('/api/v1/employer', employerRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/employer/campaigns', bulkEmailCampaignRoutes)
app.use('/api/v1/employer/deployments', deploymentRoutes)
app.use('/api/v1/employer/manpower-requests', manpowerRequestRoutes)
app.use('/api/v1/employer/contracts', contractRoutes)
app.use('/api/v1/employer/attendance', attendanceRoutes)
app.use('/api/v1/employer/payrolls', payrollRoutes)
app.use('/api/v1/employer/invoices', invoiceRoutes)
app.use('/api/v1/admin/analytics', analyticsRoutes)
app.use('/api/v1/employer/analytics', employerAnalyticsRoutes)
app.use('/api/v1/employer/analytics', employerTrendsRoutes)
app.use('/api/v1/employer/analytics', employerSegmentAnalyticsRoutes)
app.use('/api/v1/admin/audit', adminAuditRoutes)
app.use('/api/v1/internal', internalCommunicationRoutes)

app.get('/', (req, res) => {
  res.json({ success: true, message: 'InstaHire API is running 🚀' })
})

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    database: sequelize.authenticate ? 'configured' : 'unavailable',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

app.get('/uploads-check', (req, res) => {
  const files = fs.existsSync(resumesDir)
    ? fs.readdirSync(resumesDir)
    : []

  res.json({
    success: true,
    uploadsDir,
    resumesDir,
    resumesDirectoryExists: fs.existsSync(resumesDir),
    files
  })
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  })
})

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err)
  if (res.headersSent) return next(err)

  res.status(err.statusCode || err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  })
})

async function startServer() {
  try {
    await sequelize.authenticate()
    const [dbInfo] = await sequelize.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS schema_name,
        current_user AS database_user
    `)

    console.log('Backend database:', dbInfo[0])
    console.log('✅ Database connected')

    await createRedisConnection()
    // createRedisConnection already logs its connection status.

    await connectElasticsearch()
    await ensureJobsIndex()

    // Start cron only after all required services are available.
    startSubscriptionCron()

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📁 Uploads folder: ${uploadsDir}`)
      console.log(`📁 Resume uploads folder: ${resumesDir}`)
      console.log(`📄 Upload check: http://localhost:${PORT}/uploads-check`)
      console.log(`❤️ Health check: http://localhost:${PORT}/health`)
      console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`)
    })
  } catch (error) {
    console.error('❌ Server startup failed:', error.message)
    process.exit(1)
  }
}

startServer()

module.exports = app