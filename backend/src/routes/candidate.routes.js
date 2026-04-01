const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidate.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/profile', protect, authorize('candidate'), candidateController.getProfile);
router.post('/profile', protect, authorize('candidate'), candidateController.createProfile);
router.put('/profile', protect, authorize('candidate'), candidateController.updateProfile);

router.post('/photo', protect, authorize('candidate'), (req, res, next) => {
  candidateController.uploadPhotoMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, candidateController.uploadPhoto);

router.post('/resume', protect, authorize('candidate'), (req, res, next) => {
  candidateController.uploadResumeMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, candidateController.uploadResume);

router.get('/ai-match/:jobId', protect, authorize('employer', 'admin'), candidateController.getAIMatches);

module.exports = router;
