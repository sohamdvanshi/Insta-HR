const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const {
  getEmployerSegmentPerformance,
} = require('../controllers/employerSegmentAnalytics.controller');

router.get(
  '/segment-performance',
  protect,
  authorize('employer'),
  getEmployerSegmentPerformance
);

module.exports = router;