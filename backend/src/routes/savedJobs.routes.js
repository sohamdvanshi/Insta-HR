const express = require('express');
const router = express.Router();
const savedJobsController = require('../controllers/savedJobs.controller');
const { protect, authorize } = require('../middleware/auth');

// Saved jobs
router.post('/save/:jobId', protect, authorize('candidate'), savedJobsController.saveJob);
router.get('/saved', protect, authorize('candidate'), savedJobsController.getSavedJobs);
router.get('/saved/check/:jobId', protect, authorize('candidate'), savedJobsController.checkSaved);

// Job alerts
router.post('/alerts', protect, authorize('candidate'), savedJobsController.createAlert);
router.get('/alerts', protect, authorize('candidate'), savedJobsController.getAlerts);
router.delete('/alerts/:id', protect, authorize('candidate'), savedJobsController.deleteAlert);
router.patch('/alerts/:id/toggle', protect, authorize('candidate'), savedJobsController.toggleAlert);

module.exports = router;
