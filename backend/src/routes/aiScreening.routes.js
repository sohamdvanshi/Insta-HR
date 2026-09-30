const express = require('express')

const router = express.Router()

const {
  screenCandidates,
  updateApplicationStatus
} = require(
  '../controllers/aiScreening.controller'
)

const {
  protect,
  authorize
} = require('../middleware/auth')

/*
|--------------------------------------------------------------------------
| AI Resume Screening
|--------------------------------------------------------------------------
|
| Employer or admin can screen all candidates
| who applied for a specific job.
|--------------------------------------------------------------------------
*/

router.get(
  '/screen/:jobId',
  protect,
  authorize('employer', 'admin'),
  screenCandidates
)

/*
|--------------------------------------------------------------------------
| Update Application Status
|--------------------------------------------------------------------------
|
| When status changes to hired, the controller
| triggers the referral reward flow.
|--------------------------------------------------------------------------
*/

router.patch(
  '/application/:applicationId/status',
  protect,
  authorize('employer', 'admin'),
  updateApplicationStatus
)

module.exports = router