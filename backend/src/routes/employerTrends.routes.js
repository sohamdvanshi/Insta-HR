const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const {
  getEmployerHiringTrends,
} = require('../controllers/employerTrends.controller');

router.get('/trends', protect, authorize('employer'), getEmployerHiringTrends);

module.exports = router;