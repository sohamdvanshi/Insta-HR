const express = require('express')
const router = express.Router()

const adminController = require('../controllers/admin.controller')
const workspace = require('../controllers/adminWorkspace.controller')
const {
  protect,
  authorize
} = require('../middleware/auth')

// Existing admin endpoints remain available to admin and super_admin.
router.use(
  protect,
  authorize('admin', 'super_admin')
)

router.get('/stats', adminController.getStats)
router.get('/jobs', adminController.getAllJobs)
router.put('/jobs/:id/status', workspace.jobStatus)
router.get('/users', adminController.getAllUsers)
router.put('/users/:id/toggle', workspace.changeAccess)

// Only super_admin may change roles, including assigning super_admin.
router.put(
  '/users/:id/role',
  authorize('super_admin'),
  workspace.changeRole
)

module.exports = router
