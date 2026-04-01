const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/resumeUpload');

router.post(
  '/apply/:jobId',
  protect,
  authorize('candidate'),
  upload.single('resume'),
  applicationController.applyToJob
);

router.get('/my', protect, authorize('candidate'), applicationController.getMyApplications);
router.get('/job/:jobId', protect, authorize('employer', 'admin'), applicationController.getApplicationsForJob);
router.get('/:id', protect, applicationController.getApplicationById);

router.patch('/:id/status', protect, authorize('employer', 'admin'), applicationController.updateApplicationStatus);
router.patch('/:id/manual-review', protect, authorize('employer', 'admin'), applicationController.updateManualReview);
router.post('/:id/rescreen', protect, authorize('employer', 'admin'), applicationController.rescreenApplication);

router.delete('/:id', protect, applicationController.deleteApplication);

module.exports = router;