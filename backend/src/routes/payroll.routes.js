const express = require('express');
const router = express.Router();

const {
  createPayroll,
  getEmployerPayrolls,
  updatePayrollStatus,
} = require('../controllers/payroll.controller');

const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('employer'), createPayroll);
router.get('/', protect, authorize('employer'), getEmployerPayrolls);
router.patch('/:id/status', protect, authorize('employer'), updatePayrollStatus);

module.exports = router;