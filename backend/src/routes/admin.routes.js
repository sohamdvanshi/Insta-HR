const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', adminController.getStats);
router.get('/jobs', adminController.getAllJobs);
router.put('/jobs/:id/status', adminController.updateJobStatus);
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/toggle', adminController.toggleUserActive);

module.exports = router;
