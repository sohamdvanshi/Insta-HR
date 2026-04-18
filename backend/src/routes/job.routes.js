const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');
const { protect, authorize } = require('../middleware/auth');
const { cacheResponse } = require('../middleware/cache');

router.get(
  '/',
  cacheResponse({ prefix: 'jobs-list', ttl: 180 }),
  jobController.getAllJobs
);

router.get(
  '/search/advanced',
  cacheResponse({ prefix: 'jobs-search-advanced', ttl: 120 }),
  jobController.searchJobs
);

router.get(
  '/my',
  protect,
  authorize('employer', 'admin'),
  cacheResponse({
    prefix: 'jobs-my',
    ttl: 120,
    keyBuilder: (req) => `instahr:employer-${req.user.id}:jobs-my`
  }),
  jobController.getMyJobs
);

router.get(
  '/:id',
  cacheResponse({ prefix: 'job-detail', ttl: 300 }),
  jobController.getJobById
);

router.post('/', protect, authorize('employer', 'admin'), jobController.createJob);
router.patch('/:id', protect, authorize('employer', 'admin'), jobController.updateJob);
router.patch('/:id/close', protect, authorize('employer', 'admin'), jobController.closeJob);
router.patch('/:id/reopen', protect, authorize('employer', 'admin'), jobController.reopenJob);
router.delete('/:id', protect, authorize('employer', 'admin'), jobController.deleteJob);

module.exports = router;