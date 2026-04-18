const express = require('express');
const router = express.Router();
const controller = require('../controllers/bulkEmailCampaign.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('employer'), controller.createCampaign);
router.get('/', protect, authorize('employer'), controller.getMyCampaigns);
router.get(
  '/jobs/:jobId/shortlisted-candidates',
  protect,
  authorize('employer'),
  controller.getShortlistedCandidatesForJob
);
router.post('/:id/send', protect, authorize('employer'), controller.sendCampaign);

module.exports = router;