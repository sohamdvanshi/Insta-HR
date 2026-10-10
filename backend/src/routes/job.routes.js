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
  authorize('employer', 'admin', 'super_admin'),
  cacheResponse({
    prefix: 'jobs-my',
    ttl: 120,
    keyBuilder: (req) => `instahr:employer-${req.user.id}:jobs-my`
  }),
  jobController.getMyJobs
);

router.get(
  '/:id',
  (req, res, next) => req.headers.authorization ? protect(req, res, next) : next(),
  cacheResponse({ prefix: 'job-detail', ttl: 300 }),
  jobController.getJobById
);

router.post('/', protect, authorize('employer', 'admin', 'super_admin'), jobController.createJob);
router.patch('/:id', protect, authorize('employer', 'admin', 'super_admin'), jobController.updateJob);
router.patch('/:id/close', protect, authorize('employer', 'admin', 'super_admin'), jobController.closeJob);
router.patch('/:id/reopen', protect, authorize('employer', 'admin', 'super_admin'), jobController.reopenJob);
router.delete('/:id', protect, authorize('employer', 'admin', 'super_admin'), jobController.deleteJob);

module.exports = router;