const express = require('express')

const router = express.Router()

const referralController = require('../controllers/referral.controller')
const {
  protect,
  authorize
} = require('../middleware/auth')

/*
|--------------------------------------------------------------------------
| Candidate Referral Code
|--------------------------------------------------------------------------
*/

router.get(
  '/code',
  protect,
  authorize('candidate'),
  referralController.getMyReferralCode
)

/*
|--------------------------------------------------------------------------
| Candidate Referral Tracking
|--------------------------------------------------------------------------
*/

router.get(
  '/my',
  protect,
  authorize('candidate'),
  referralController.getMyReferrals
)

router.get(
  '/points',
  protect,
  authorize('candidate'),
  referralController.getMyLoyaltyPoints
)

// Alias retained for clients using the longer endpoint name.
router.get(
  '/loyalty-points',
  protect,
  authorize('candidate'),
  referralController.getMyLoyaltyPoints
)

/*
|--------------------------------------------------------------------------
| Employer Referral Tracking
|--------------------------------------------------------------------------
|
| The frontend referral tracking page calls:
| GET /api/v1/referrals/employer/tracking
|
| The older /employer endpoint is retained below so existing clients do
| not break.
|--------------------------------------------------------------------------
*/

router.get(
  '/employer/tracking',
  protect,
  authorize('employer', 'admin', 'super_admin'),
  referralController.getEmployerReferrals
)

router.get(
  '/employer',
  protect,
  authorize('employer', 'admin', 'super_admin'),
  referralController.getEmployerReferrals
)

/*
|--------------------------------------------------------------------------
| Admin Referral Tracking
|--------------------------------------------------------------------------
*/

router.get(
  '/admin',
  protect,
  authorize('admin', 'super_admin'),
  referralController.getAdminReferrals
)

/*
|--------------------------------------------------------------------------
| Admin Manual Reward Recovery
|--------------------------------------------------------------------------
|
| This endpoint is only for recovering a reward for an already-hired
| referred application.
|--------------------------------------------------------------------------
*/

router.post(
  '/applications/:applicationId/award',
  protect,
  authorize('admin', 'super_admin'),
  referralController.awardReferralPoints
)

// Alias retained for clients using the award-points endpoint name.
router.post(
  '/:applicationId/award-points',
  protect,
  authorize('admin', 'super_admin'),
  referralController.awardReferralPoints
)

/*
|--------------------------------------------------------------------------
| Disabled Legacy Referral Creation
|--------------------------------------------------------------------------
|
| Referrals are now linked automatically when a candidate applies using
| referralCode. This route is retained for backward compatibility.
|--------------------------------------------------------------------------
*/

router.post(
  '/',
  protect,
  authorize('candidate', 'employer', 'admin', 'super_admin'),
  referralController.createReferral
)

/*
|--------------------------------------------------------------------------
| Referral Details
|--------------------------------------------------------------------------
|
| Keep this dynamic route after all specific routes so /admin, /employer,
| /points and the other fixed paths are not treated as referral IDs.
|--------------------------------------------------------------------------
*/

router.get(
  '/:id',
  protect,
  authorize('candidate', 'employer', 'admin', 'super_admin'),
  referralController.getReferralById
)

module.exports = router