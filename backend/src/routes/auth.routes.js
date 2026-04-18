const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

module.exports = router;