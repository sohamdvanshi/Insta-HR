const express = require('express')
const router = express.Router()

const controller = require('../controllers/internalCommunication.controller')
const {
  protect,
  authorize
} = require('../middleware/auth')

router.use(
  protect,
  authorize('admin', 'super_admin')
)

router.get('/threads', controller.listThreads)
router.post('/threads', controller.createThread)
router.get('/threads/:id', controller.getThread)
router.post('/threads/:id/messages', controller.addMessage)
router.put('/threads/:id/status', controller.updateThreadStatus)
router.put('/threads/:id/assign', controller.assignThread)

router.get('/staff', authorize('super_admin'), controller.listStaff)

router.post('/notes', controller.createNote)
router.get('/notes/:entityType/:entityId', controller.listNotes)
router.delete('/notes/:id', controller.deleteNote)

module.exports = router
