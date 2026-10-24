const express = require('express');
const router = express.Router();

const {
  downloadInvoice,
  createInvoice,
  getEmployerInvoices,
  updateInvoiceStatus,
} = require('../controllers/invoice.controller');

const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('employer'), createInvoice);
router.get('/', protect, authorize('employer'), getEmployerInvoices);
router.get('/:id/pdf', protect, authorize('employer', 'admin', 'super_admin'), downloadInvoice);
router.patch('/:id/status', protect, authorize('employer'), updateInvoiceStatus);

module.exports = router;