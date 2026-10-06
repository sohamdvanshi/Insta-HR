const jwt = require('jsonwebtoken');
const { FeatureFlag, User } = require('../models');
const { FLAGS } = require('./adminPolicy');
const requireFeature = key => async (req, res, next) => {
  try {
    if (!FLAGS[key]) throw new Error('Unknown feature');
    const flag = await FeatureFlag.findByPk(key);
    if (!flag) return res.status(503).json({ success: false, message: 'System configuration is incomplete. Contact support.' });
    if (flag.enabled) return next();
    // Admins retain management access while a module is disabled for users.
    let staff = req.user;
    if (!staff && req.headers.authorization?.startsWith('Bearer ') && process.env.JWT_SECRET) {
      try { const decoded = jwt.verify(req.headers.authorization.slice(7), process.env.JWT_SECRET); staff = await User.findByPk(decoded.id); } catch { /* Guests do not receive staff bypass. */ }
    }
    if (staff?.isActive && ['admin', 'super_admin'].includes(staff.role)) return next();
    return res.status(503).json({ success: false, code: 'FEATURE_DISABLED', message: `${FLAGS[key]} is temporarily unavailable.` });
  } catch (error) {
    console.error('Feature control:', error.message);
    return res.status(503).json({ success: false, message: 'Unable to check module availability. Contact support.' });
  }
};
module.exports = { requireFeature };
