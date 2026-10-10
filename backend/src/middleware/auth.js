const jwt = require('jsonwebtoken')
const { User } = require('../models/index')

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization

  if (
    !authHeader ||
    typeof authHeader !== 'string' ||
    !authHeader.startsWith('Bearer ')
  ) {
    return null
  }

  const token = authHeader.slice(7).trim()
  return token || null
}

exports.protect = async (req, res, next) => {
  try {
    const token = getBearerToken(req)

    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_REQUIRED',
        message: 'Please login to access this resource'
      })
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured')

      return res.status(500).json({
        success: false,
        message: 'Authentication is not configured'
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN_PAYLOAD',
        message: 'Invalid token payload. Please login again.'
      })
    }

    const user = await User.findByPk(decoded.id)

    if (!user) {
      console.error(
        'AUTH DEBUG: user not found for token id:',
        decoded.id
      )

      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'User account no longer exists. Please login again.'
      })
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account is inactive'
      })
    }

    if (user.role === 'trainer' && !/^\/api\/v1\/training(?:\/|$)/.test(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ success: false, message: 'Trainer accounts only have access to training modules' })
    }

    req.user = user
    return next()
  } catch (error) {
    console.error('Authentication error:', error.message)

    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(503).json({ success: false, message: 'Authentication service unavailable. Please try again.' })
    }
    return res.status(401).json({
      success: false,
      code: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'Invalid or expired token. Please login again.'
    })
  }
}

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have permission'
      })
    }

    return next()
  }
}

exports.requireAdmin = exports.authorize('admin', 'super_admin')
exports.requireSuperAdmin = exports.authorize('super_admin')
