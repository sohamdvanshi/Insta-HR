const { Op } = require('sequelize')
const {
  Job,
  User,
  Application,
  Payment
} = require('../models/index')

const ALLOWED_ROLES = [
  'candidate',
  'employer',
  'admin',
  'trainer',
  'super_admin'
]

const isSuperAdmin = (req) => req.user?.role === 'super_admin'

exports.getStats = async (req, res) => {
  try {
    const totalJobs = await Job.count()
    const totalUsers = await User.count({
      where: {
        role: {
          [Op.in]: ['candidate', 'employer']
        }
      }
    })
    const totalApplications = await Application.count()

    const revenueResult = await Payment.sum('amount', {
      where: { status: 'success' }
    })

    return res.json({
      success: true,
      data: {
        totalJobs,
        totalUsers,
        totalApplications,
        revenue: revenueResult || 0
      }
    })
  } catch (error) {
    console.error('getStats error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.findAll({
      order: [['createdAt', 'DESC']]
    })

    return res.json({
      success: true,
      data: jobs
    })
  } catch (error) {
    console.error('getAllJobs error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.updateJobStatus = async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id)

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      })
    }

    await job.update({
      status: req.body.status
    })

    return res.json({
      success: true,
      data: job
    })
  } catch (error) {
    console.error('updateJobStatus error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        'id',
        'email',
        'phone',
        'role',
        'isActive',
        'isEmailVerified',
        'subscriptionPlan',
        'subscriptionExpiry',
        'createdAt'
      ],
      order: [['createdAt', 'DESC']]
    })

    return res.json({
      success: true,
      count: users.length,
      data: users
    })
  } catch (error) {
    console.error('getAllUsers error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.updateUserRole = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only super_admin can change user roles'
      })
    }

    const { role } = req.body

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role'
      })
    }

    const user = await User.findByPk(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    if (user.id === req.user.id && role !== 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own super_admin role'
      })
    }

    if (user.role === 'super_admin' && role !== 'super_admin') {
      const activeSuperAdminCount = await User.count({
        where: {
          role: 'super_admin',
          isActive: true
        }
      })

      if (activeSuperAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'At least one active super_admin must remain'
        })
      }
    }

    const previousRole = user.role
    await user.update({ role })

    return res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        id: user.id,
        email: user.email,
        previousRole,
        role: user.role
      }
    })
  } catch (error) {
    console.error('updateUserRole error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.toggleUserActive = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    if (user.id === req.user.id && user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      })
    }

    if (user.role === 'super_admin' && user.isActive) {
      const activeSuperAdminCount = await User.count({
        where: {
          role: 'super_admin',
          isActive: true
        }
      })

      if (activeSuperAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'At least one active super_admin must remain'
        })
      }
    }

    await user.update({
      isActive: !user.isActive
    })

    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        isActive: user.isActive
      }
    })
  } catch (error) {
    console.error('toggleUserActive error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
