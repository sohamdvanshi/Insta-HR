const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, sequelize } = require('../models');
const emailService = require('../services/email/emailService');

const TTL = 15 * 60 * 1000;
const GENERIC = 'If an eligible account exists, a password reset link has been sent. Check your inbox and spam folder.';
const INVALID = 'This password reset link is invalid or expired. Request a new link.';
const digest = token => crypto.createHash('sha256').update(token).digest('hex');

function resetURL(token) {
  const configured = process.env.FRONTEND_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
  const base = new URL(configured);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) {
    throw new Error('FRONTEND_URL must use HTTPS (HTTP is allowed for localhost).');
  }
  const url = new URL('/reset-password', base);
  // A fragment keeps the secret out of HTTP access logs and Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

exports.forgotPassword = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (user && user.isActive && user.isEmailVerified && user.password) {
      const token = crypto.randomBytes(32).toString('hex');
      const url = resetURL(token);
      const hash = digest(token), now = Date.now();
      // Atomic per-account cooldown also prevents two requests rotating each other's links.
      const [issued] = await User.update({ passwordResetTokenHash: hash, passwordResetExpiresAt: new Date(now + TTL) }, {
        where: { id: user.id, isActive: true, isEmailVerified: true, [Op.or]: [
          { passwordResetExpiresAt: null }, { passwordResetExpiresAt: { [Op.lte]: new Date(now + TTL - 60000) } }
        ] }
      });
      if (issued) {
        try { await emailService.sendPasswordResetEmail(user.email, url); }
        catch (error) {
          await User.update({ passwordResetTokenHash: null, passwordResetExpiresAt: null }, { where: { id: user.id, passwordResetTokenHash: hash } });
          console.error('Password reset email delivery failed:', error.message);
        }
      }
    }
    return res.json({ success: true, message: GENERIC });
  } catch (error) {
    console.error('Password reset request failed:', error.message);
    // Configuration/provider errors must not disclose account existence.
    return res.json({ success: true, message: GENERIC });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ success: false, message: INVALID });
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ success: false, message: 'Use at least 8 characters and no more than 72 UTF-8 bytes for your password.' });
  }
  try {
    const changed = await sequelize.transaction(async transaction => {
      const user = await User.findOne({
        where: { passwordResetTokenHash: digest(token), passwordResetExpiresAt: { [Op.gt]: new Date() }, isActive: true, isEmailVerified: true },
        transaction, lock: transaction.LOCK.UPDATE
      });
      if (!user || !user.password) return false;
      await user.update({ password: await bcrypt.hash(password, 12), passwordResetTokenHash: null, passwordResetExpiresAt: null, authVersion: Number(user.authVersion || 0) + 1 }, { transaction });
      return true;
    });
    if (!changed) return res.status(400).json({ success: false, message: INVALID });
    return res.json({ success: true, message: 'Password changed successfully. Sign in with your new password.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return res.status(503).json({ success: false, message: 'Unable to reset your password right now. Please try again.' });
  }
};
