const express = require('express');
const router = express.Router();
const employerController = require('../controllers/employer.controller');
const { protect, authorize } = require('../middleware/auth');

// Employer routes
router.get('/profile', protect, authorize('employer'), employerController.getProfile);
router.put('/profile', protect, authorize('employer'), employerController.upsertProfile);
router.post('/logo', protect, authorize('employer'), (req, res, next) => {
  employerController.uploadLogoMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, employerController.uploadLogo);

// Public route - candidates can view company profile
router.get('/public/:userId', employerController.getPublicProfile);

// Admin routes
router.get('/all', protect, authorize('admin'), employerController.getAllProfiles);
router.put('/verify/:userId', protect, authorize('admin'), employerController.verifyEmployer);

module.exports = router;
