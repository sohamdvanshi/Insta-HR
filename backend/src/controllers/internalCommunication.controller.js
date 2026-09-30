const {
  InternalThread,
  InternalMessage,
  InternalNote,
  User
} = require('../models')

const isStaff = (req) => (
  req.user?.role === 'admin' || req.user?.role === 'super_admin'
)

const isSuperAdmin = (req) => req.user?.role === 'super_admin'

const allowedCategories = [
  'general',
  'candidate',
  'employer',
  'job',
  'application',
  'payment',
  'payroll',
  'referral',
  'fraud'
]

const allowedPriorities = ['low', 'normal', 'high', 'urgent']
const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed']

const cleanText = (value) => (
  value === null || value === undefined ? '' : String(value).trim()
)

const getPagination = (req) => {
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
  return { page, limit, offset: (page - 1) * limit }
}

const getThreadInclude = () => [
  {
    model: User,
    as: 'creator',
    attributes: ['id', 'email', 'role'],
    required: false
  },
  {
    model: User,
    as: 'assignee',
    attributes: ['id', 'email', 'role'],
    required: false
  },
  {
    model: InternalMessage,
    as: 'messages',
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'email', 'role'],
        required: false
      }
    ],
    required: false,
    separate: true,
    order: [['createdAt', 'ASC']]
  }
]

exports.listThreads = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can view internal communication'
      })
    }

    const { page, limit, offset } = getPagination(req)
    const where = {}

    if (req.query.status && allowedStatuses.includes(req.query.status)) {
      where.status = req.query.status
    }

    if (req.query.priority && allowedPriorities.includes(req.query.priority)) {
      where.priority = req.query.priority
    }

    const result = await InternalThread.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'email', 'role'],
          required: false
        },
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'email', 'role'],
          required: false
        }
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
      distinct: true
    })

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: result.count,
        pages: Math.ceil(result.count / limit)
      }
    })
  } catch (error) {
    console.error('listThreads error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.createThread = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can create internal threads'
      })
    }

    const subject = cleanText(req.body.subject)
    const body = cleanText(req.body.body)
    const category = cleanText(req.body.category) || 'general'
    const priority = cleanText(req.body.priority) || 'normal'

    if (!subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'subject and body are required'
      })
    }

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid communication category'
      })
    }

    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid communication priority'
      })
    }

    let assignedTo = req.body.assignedTo || null

    if (assignedTo) {
      const assignee = await User.findOne({
        where: {
          id: assignedTo,
          role: ['admin', 'super_admin'],
          isActive: true
        }
      })

      if (!assignee) assignedTo = null
    }

    const thread = await InternalThread.create({
      subject,
      category,
      priority,
      status: 'open',
      createdBy: req.user.id,
      assignedTo,
      relatedEntityType: req.body.relatedEntityType || null,
      relatedEntityId: req.body.relatedEntityId || null
    })

    await InternalMessage.create({
      threadId: thread.id,
      senderId: req.user.id,
      body
    })

    const created = await InternalThread.findByPk(thread.id, {
      include: getThreadInclude()
    })

    return res.status(201).json({
      success: true,
      message: 'Internal thread created successfully',
      data: created
    })
  } catch (error) {
    console.error('createThread error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.getThread = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can view internal threads'
      })
    }

    const thread = await InternalThread.findByPk(req.params.id, {
      include: getThreadInclude()
    })

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Internal thread not found'
      })
    }

    return res.json({
      success: true,
      data: thread
    })
  } catch (error) {
    console.error('getThread error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.addMessage = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can send internal messages'
      })
    }

    const body = cleanText(req.body.body)
    if (!body) {
      return res.status(400).json({
        success: false,
        message: 'Message body is required'
      })
    }

    const thread = await InternalThread.findByPk(req.params.id)
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Internal thread not found'
      })
    }

    if (thread.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Closed threads cannot receive new messages'
      })
    }

    const message = await InternalMessage.create({
      threadId: thread.id,
      senderId: req.user.id,
      body
    })

    if (thread.status === 'open') {
      await thread.update({ status: 'in_progress' })
    }

    const created = await InternalMessage.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'email', 'role']
        }
      ]
    })

    return res.status(201).json({
      success: true,
      message: 'Internal message added successfully',
      data: created
    })
  } catch (error) {
    console.error('addMessage error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.updateThreadStatus = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can update thread status'
      })
    }

    const status = cleanText(req.body.status)
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread status'
      })
    }

    const thread = await InternalThread.findByPk(req.params.id)
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Internal thread not found'
      })
    }

    await thread.update({ status })

    return res.json({
      success: true,
      message: 'Thread status updated successfully',
      data: thread
    })
  } catch (error) {
    console.error('updateThreadStatus error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.assignThread = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can assign threads'
      })
    }

    const assignedTo = req.body.assignedTo || null
    const thread = await InternalThread.findByPk(req.params.id)

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Internal thread not found'
      })
    }

    if (assignedTo) {
      const assignee = await User.findOne({
        where: {
          id: assignedTo,
          role: ['admin', 'super_admin'],
          isActive: true
        }
      })

      if (!assignee) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be an active admin or super_admin'
        })
      }
    }

    await thread.update({ assignedTo })

    return res.json({
      success: true,
      message: 'Thread assignment updated successfully',
      data: thread
    })
  } catch (error) {
    console.error('assignThread error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.listStaff = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only super_admin can view staff management data'
      })
    }

    const staff = await User.findAll({
      where: {
        role: ['admin', 'super_admin']
      },
      attributes: ['id', 'email', 'role', 'isActive', 'isEmailVerified', 'createdAt'],
      order: [['createdAt', 'DESC']]
    })

    return res.json({
      success: true,
      data: staff
    })
  } catch (error) {
    console.error('listStaff error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.createNote = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can create internal notes'
      })
    }

    const entityType = cleanText(req.body.entityType)
    const entityId = cleanText(req.body.entityId)
    const body = cleanText(req.body.body)

    if (!entityType || !entityId || !body) {
      return res.status(400).json({
        success: false,
        message: 'entityType, entityId, and body are required'
      })
    }

    const note = await InternalNote.create({
      authorId: req.user.id,
      entityType,
      entityId,
      body
    })

    return res.status(201).json({
      success: true,
      message: 'Internal note created successfully',
      data: note
    })
  } catch (error) {
    console.error('createNote error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.listNotes = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can view internal notes'
      })
    }

    const notes = await InternalNote.findAll({
      where: {
        entityType: req.params.entityType,
        entityId: req.params.entityId
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'email', 'role']
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    return res.json({
      success: true,
      data: notes
    })
  } catch (error) {
    console.error('listNotes error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

exports.deleteNote = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin staff can delete internal notes'
      })
    }

    const note = await InternalNote.findByPk(req.params.id)
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Internal note not found'
      })
    }

    if (!isSuperAdmin(req) && note.authorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own notes'
      })
    }

    await note.destroy()

    return res.json({
      success: true,
      message: 'Internal note deleted successfully'
    })
  } catch (error) {
    console.error('deleteNote error:', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
