const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const {
  generateResumeSummary,
  generateExperienceBullets,
  generateATSOptimization
} = require('../controllers/resumeAI.controller')

router.post('/resume-summary', protect, generateResumeSummary)
router.post('/experience-bullets', protect, generateExperienceBullets)
router.post('/ats-optimize', protect, generateATSOptimization)

module.exports = router