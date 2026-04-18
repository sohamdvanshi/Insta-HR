const express = require('express')
const router = express.Router()
const {
  createResume,
  getMyResumes,
  getResumeById,
  updateResume,
  deleteResume
} = require('../controllers/resume.controller')
const { protect } = require('../middleware/auth')

router.use(protect)

router.post('/', createResume)
router.get('/', getMyResumes)
router.get('/:id', getResumeById)
router.put('/:id', updateResume)
router.delete('/:id', deleteResume)

module.exports = router