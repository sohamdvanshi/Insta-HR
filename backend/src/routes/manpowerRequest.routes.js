const express = require('express');
const router = express.Router();

const {
  createManpowerRequest,
  getEmployerManpowerRequests,
  updateManpowerRequestStatus,
} = require('../controllers/manpowerRequest.controller');

const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('employer'), createManpowerRequest);
router.get('/', protect, authorize('employer'), getEmployerManpowerRequests);
router.patch('/:id/status', protect, authorize('employer'), updateManpowerRequestStatus);

module.exports = router;