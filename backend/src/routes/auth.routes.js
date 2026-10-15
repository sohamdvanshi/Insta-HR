const express = require('express');
const router = express.Router();
const passwordReset = require('../controllers/passwordReset.controller');
const { rateLimit } = require('express-rate-limit');
const recoveryLimiter = () => rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many password reset attempts. Please try again later.' } });
const authController = require('../controllers/auth.controller');

router.post('/forgot-password', recoveryLimiter(), passwordReset.forgotPassword);
router.post('/reset-password', recoveryLimiter(), passwordReset.resetPassword);

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

module.exports = router;