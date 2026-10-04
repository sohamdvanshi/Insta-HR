const express = require('express')
const router = express.Router()
const {
  getCatalog,
  getProfileDefaults,
  createResume,
  getMyResumes,
  getResumeById,
  getPublicResumeById,
  updateResume,
  deleteResume
} = require('../controllers/resume.controller')
const { protect, authorize } = require('../middleware/auth')

router.get('/catalog', getCatalog)
router.get('/public/:id', getPublicResumeById)

router.use(protect, authorize('candidate'))
router.get('/profile-defaults', getProfileDefaults)

router.post('/', createResume)
router.get('/', getMyResumes)
router.get('/:id', getResumeById)
router.put('/:id', updateResume)
router.delete('/:id', deleteResume)

module.exports = router