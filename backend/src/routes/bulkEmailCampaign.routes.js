const express = require('express')

const router = express.Router()
const controller = require('../controllers/bulkEmailCampaign.controller')
const {
  protect,
  authorize
} = require('../middleware/auth')

/*
|--------------------------------------------------------------------------
| Employer Bulk Email Campaigns
|--------------------------------------------------------------------------
*/

// Create a campaign.
// recipientStatus may be: applied, shortlisted, hired, or rejected.
router.post(
  '/',
  protect,
  authorize('employer'),
  controller.createCampaign
)

// Get the current employer's campaign history.
router.get(
  '/',
  protect,
  authorize('employer'),
  controller.getMyCampaigns
)

/*
|--------------------------------------------------------------------------
| Candidate Recipient Lists
|--------------------------------------------------------------------------
*/

// Backward-compatible shortlisted-only endpoint.
router.get(
  '/jobs/:jobId/shortlisted-candidates',
  protect,
  authorize('employer'),
  controller.getShortlistedCandidatesForJob
)

// New status-based endpoint.
// Example: GET /jobs/:jobId/candidates?status=applied
router.get(
  '/jobs/:jobId/candidates',
  protect,
  authorize('employer'),
  controller.getCandidatesForJobByStatus
)

/*
|--------------------------------------------------------------------------
| Send Campaign
|--------------------------------------------------------------------------
*/

router.post(
  '/:id/send',
  protect,
  authorize('employer'),
  controller.sendCampaign
)

module.exports = router
