const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, CandidateProfile } = require('../models/index');
const emailService = require('../services/email/emailService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Register
exports.register = async (req, res) => {
  try {
    const { email, password, phone, role, firstName, lastName } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      password: hashedPassword,
      phone,
      role,
      otp,
      otpExpiry,
      authProvider: 'local',
      isEmailVerified: false
    });

    if (role === 'candidate') {
      await CandidateProfile.create({
        userId: user.id,
        firstName: firstName || '',
        lastName: lastName || ''
      });
    }

    await emailService.sendOTPEmail(email, otp);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email with OTP.',
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    await user.update({
      isEmailVerified: true,
      otp: null,
      otpExpiry: null
    });

    if (typeof emailService.sendWelcomeEmail === 'function') {
      await emailService.sendWelcomeEmail(
        user.email,
        user.firstName || user.name || user.email
      );
    }

    const token = signToken(user.id);

    res.json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { userId, email } = req.body;

    let user = null;

    if (userId) {
      user = await User.findByPk(userId);
    } else if (email) {
      user = await User.findOne({ where: { email } });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await user.update({ otp, otpExpiry });
    await emailService.sendOTPEmail(user.email, otp);

    res.json({
      success: true,
      message: 'OTP resent successfully!',
      userId: user.id,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in',
        userId: user.id,
        email: user.email
      });
    }

    await user.update({ lastLogin: new Date() });

    const token = signToken(user.id);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Google Login
exports.googleLogin = async (req, res) => {
  try {
    const { credential, role, firstName, lastName } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const {
      sub: googleId,
      email,
      email_verified,
      name,
      picture,
      given_name,
      family_name
    } = payload;

    if (!email || !email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Google email is not verified'
      });
    }

    let user = await User.findOne({ where: { googleId } });

    if (!user) {
      user = await User.findOne({ where: { email } });

      if (user) {
        await user.update({
          googleId,
          authProvider: user.authProvider === 'local' ? 'google+local' : 'google',
          avatar: picture || user.avatar,
          isEmailVerified: true,
          lastLogin: new Date()
        });
      } else {
        user = await User.create({
          email,
          password: null,
          phone: null,
          googleId,
          authProvider: 'google',
          avatar: picture || null,
          role: role || 'candidate',
          isEmailVerified: true,
          isActive: true,
          lastLogin: new Date()
        });

        if ((role || 'candidate') === 'candidate') {
          await CandidateProfile.create({
            userId: user.id,
            firstName: firstName || given_name || name?.split(' ')[0] || '',
            lastName: lastName || family_name || name?.split(' ').slice(1).join(' ') || ''
          });
        }

        if (typeof emailService.sendWelcomeEmail === 'function') {
          await emailService.sendWelcomeEmail(email, given_name || name || email);
        }
      }
    } else {
      await user.update({
        avatar: picture || user.avatar,
        isEmailVerified: true,
        lastLogin: new Date()
      });
    }

    const token = signToken(user.id);

    return res.json({
      success: true,
      message: 'Google login successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Google login failed'
    });
  }
};
