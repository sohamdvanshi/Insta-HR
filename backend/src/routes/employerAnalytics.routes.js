const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const {
  getEmployerFunnelAnalytics,
} = require('../controllers/employerAnalytics.controller');

router.get('/funnel', protect, authorize('employer'), getEmployerFunnelAnalytics);

module.exports = router;