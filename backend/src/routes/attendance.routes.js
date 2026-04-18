const express = require('express');
const router = express.Router();

const {
  createAttendance,
  getEmployerAttendance,
  updateAttendance,
} = require('../controllers/attendance.controller');

const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('employer'), createAttendance);
router.get('/', protect, authorize('employer'), getEmployerAttendance);
router.patch('/:id', protect, authorize('employer'), updateAttendance);

module.exports = router;