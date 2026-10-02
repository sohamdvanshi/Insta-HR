const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const controller = require('../controllers/aiScreening.controller')
router.use(protect, authorize('employer', 'admin', 'super_admin'))
router.get('/screen/:jobId', controller.screenCandidates)
router.patch('/application/:applicationId/status', controller.updateApplicationStatus)
module.exports = router
