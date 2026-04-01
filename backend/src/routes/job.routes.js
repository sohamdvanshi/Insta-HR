const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', jobController.getAllJobs);
router.get('/my', protect, authorize('employer', 'admin'), jobController.getMyJobs);
router.get('/:id', jobController.getJobById);

router.post('/', protect, authorize('employer', 'admin'), jobController.createJob);
router.patch('/:id', protect, authorize('employer', 'admin'), jobController.updateJob);
router.patch('/:id/close', protect, authorize('employer', 'admin'), jobController.closeJob);
router.patch('/:id/reopen', protect, authorize('employer', 'admin'), jobController.reopenJob);
router.delete('/:id', protect, authorize('employer', 'admin'), jobController.deleteJob);

module.exports = router;