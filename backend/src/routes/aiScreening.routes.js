const express = require('express');
const router = express.Router();
const { screenCandidates, updateApplicationStatus } = require('../controllers/aiScreening.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/screen/:jobId', protect, authorize('employer', 'admin'), screenCandidates);
router.patch('/application/:applicationId/status', protect, authorize('employer', 'admin'), updateApplicationStatus);

module.exports = router;
