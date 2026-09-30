const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { OAuth2Client } = require('google-auth-library')

const { User, CandidateProfile } = require('../models/index')
const emailService = require('../services/email/emailService')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const REFERRAL_CODE_PREFIX = 'INSTA'
const REFERRAL_CODE_LENGTH = 7
const MAX_REFERRAL_CODE_ATTEMPTS = 10
const REFERRAL_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ALLOWED_ROLES = ['candidate', 'employer']

const normalizeEmail = (email) => {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

const normalizeRole = (role) => {
  const value = String(role || 'candidate').trim().toLowerCase()
  return ALLOWED_ROLES.includes(value) ? value : null
}

const generateOTP = () => crypto.randomInt(100000, 1000000).toString()

const signToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign(
    { id: String(id) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

const generateReferralCode = () => {
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH)
  let randomPart = ''

  for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
    randomPart += REFERRAL_CHARACTERS[
      bytes[index] % REFERRAL_CHARACTERS.length
    ]
  }

  return `${REFERRAL_CODE_PREFIX}${randomPart}`
}

const generateUniqueReferralCode = async () => {
  for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    const referralCode = generateReferralCode()
    const existingUser = await User.findOne({
      where: { referralCode },
      attributes: ['id']
    })

    if (!existingUser) return referralCode
  }

  throw new Error('Could not generate a unique referral code')
}

const getReferralCodeForRole = async (role) => {
  return role === 'candidate'
    ? generateUniqueReferralCode()
    : null
}

const ensureCandidateReferralCode = async (user) => {
  if (user.role !== 'candidate' || user.referralCode) return user

  await user.update({
    referralCode: await generateUniqueReferralCode()
  })

  return user
}

const isReferralCodeUniqueConstraintError = (error) => {
  return error?.name === 'SequelizeUniqueConstraintError' && (
    error?.fields?.referralCode ||
    error?.parent?.constraint?.toLowerCase().includes('referral')
  )
}

const getUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  authProvider: user.authProvider,
  avatar: user.avatar || null,
  isEmailVerified: user.isEmailVerified,
  referralCode: user.referralCode || null
})

const sendWelcomeEmail = async (email, name) => {
  if (typeof emailService.sendWelcomeEmail === 'function') {
    await emailService.sendWelcomeEmail(email, name)
  }
}

exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      phone,
      role,
      firstName,
      lastName
    } = req.body

    const normalizedEmail = normalizeEmail(email)
    const normalizedRole = normalizeRole(role)

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    if (!normalizedRole) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed roles are candidate and employer'
      })
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      })
    }

    const existing = await User.findOne({
      where: { email: normalizedEmail },
      attributes: ['id']
    })

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use'
      })
    }

    const otp = generateOTP()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)
    const hashedPassword = await bcrypt.hash(password, 12)

    let user

    try {
      user = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        phone: typeof phone === 'string' ? phone.trim() || null : null,
        role: normalizedRole,
        referralCode: await getReferralCodeForRole(normalizedRole),
        otp,
        otpExpiry,
        authProvider: 'local',
        isEmailVerified: false,
        isActive: true
      })
    } catch (error) {
      if (!isReferralCodeUniqueConstraintError(error)) throw error

      user = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        phone: typeof phone === 'string' ? phone.trim() || null : null,
        role: normalizedRole,
        referralCode: await generateUniqueReferralCode(),
        otp,
        otpExpiry,
        authProvider: 'local',
        isEmailVerified: false,
        isActive: true
      })
    }

    if (normalizedRole === 'candidate') {
      await CandidateProfile.create({
        userId: user.id,
        firstName: typeof firstName === 'string' ? firstName.trim() : '',
        lastName: typeof lastName === 'string' ? lastName.trim() : ''
      })
    }

    await emailService.sendOTPEmail(normalizedEmail, otp)

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email with OTP.',
      userId: user.id,
      user: getUserResponse(user)
    })
  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    })
  }
}

exports.verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body
    const user = await User.findByPk(userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    if (!otp || user.otp !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      })
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      })
    }

    await user.update({
      isEmailVerified: true,
      otp: null,
      otpExpiry: null
    })

    await ensureCandidateReferralCode(user)
    await sendWelcomeEmail(user.email, user.email)

    return res.json({
      success: true,
      message: 'Email verified successfully!',
      token: signToken(user.id),
      user: getUserResponse(user)
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return res.status(500).json({
      success: false,
      message: 'OTP verification failed'
    })
  }
}

exports.resendOTP = async (req, res) => {
  try {
    const { userId, email } = req.body
    let user = null

    if (userId) {
      user = await User.findByPk(userId)
    } else if (email) {
      user = await User.findOne({
        where: { email: normalizeEmail(email) }
      })
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified'
      })
    }

    const otp = generateOTP()

    await user.update({
      otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
    })

    await emailService.sendOTPEmail(user.email, otp)

    return res.json({
      success: true,
      message: 'OTP resent successfully!',
      userId: user.id,
      email: user.email
    })
  } catch (error) {
    console.error('Resend OTP error:', error)
    return res.status(500).json({
      success: false,
      message: 'Unable to resend OTP'
    })
  }
}

exports.login = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email)
    const { password } = req.body

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    const user = await User.findOne({
      where: { email: normalizedEmail }
    })

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    const isMatch = await user.comparePassword(password)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive'
      })
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in',
        userId: user.id,
        email: user.email
      })
    }

    await ensureCandidateReferralCode(user)
    await user.update({ lastLogin: new Date() })

    return res.json({
      success: true,
      message: 'Login successful!',
      token: signToken(user.id),
      user: getUserResponse(user)
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    })
  }
}

exports.googleLogin = async (req, res) => {
  try {
    const {
      credential,
      role,
      firstName,
      lastName
    } = req.body

    if (!credential || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        message: 'Google login is not configured correctly'
      })
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()

    if (!payload?.email || !payload.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Google email is not verified'
      })
    }

    const {
      sub: googleId,
      email,
      picture,
      name,
      given_name: givenName,
      family_name: familyName
    } = payload

    const normalizedEmail = normalizeEmail(email)
    let user = await User.findOne({ where: { googleId } })

    if (!user) {
      user = await User.findOne({
        where: { email: normalizedEmail }
      })
    }

    if (user) {
      await user.update({
        googleId,
        avatar: picture || user.avatar,
        isEmailVerified: true,
        lastLogin: new Date(),
        authProvider: user.authProvider === 'local'
          ? 'google+local'
          : 'google'
      })
    } else {
      const normalizedRole = normalizeRole(role)

      if (!normalizedRole) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Allowed roles are candidate and employer'
        })
      }

      try {
        user = await User.create({
          email: normalizedEmail,
          password: null,
          phone: null,
          googleId,
          authProvider: 'google',
          avatar: picture || null,
          role: normalizedRole,
          referralCode: await getReferralCodeForRole(normalizedRole),
          isEmailVerified: true,
          isActive: true,
          lastLogin: new Date()
        })
      } catch (error) {
        if (!isReferralCodeUniqueConstraintError(error)) throw error

        user = await User.create({
          email: normalizedEmail,
          password: null,
          phone: null,
          googleId,
          authProvider: 'google',
          avatar: picture || null,
          role: normalizedRole,
          referralCode: await generateUniqueReferralCode(),
          isEmailVerified: true,
          isActive: true,
          lastLogin: new Date()
        })
      }

      if (normalizedRole === 'candidate') {
        await CandidateProfile.create({
          userId: user.id,
          firstName: typeof firstName === 'string'
            ? firstName.trim()
            : givenName || name?.split(' ')[0] || '',
          lastName: typeof lastName === 'string'
            ? lastName.trim()
            : familyName || name?.split(' ').slice(1).join(' ') || ''
        })
      }

      await sendWelcomeEmail(
        normalizedEmail,
        givenName || name || normalizedEmail
      )
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive'
      })
    }

    await ensureCandidateReferralCode(user)

    return res.json({
      success: true,
      message: 'Google login successful!',
      token: signToken(user.id),
      user: getUserResponse(user)
    })
  } catch (error) {
    console.error('Google login error:', error)
    return res.status(500).json({
      success: false,
      message: 'Google login failed'
    })
  }
}