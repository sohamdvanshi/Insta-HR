const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const {
  getAuditLogs,
  getFraudAlerts,
  getFraudAlertsSummary,
  updateFraudAlertStatus,
  getAuditDashboardSummary,
} = require('../controllers/adminAudit.controller');

router.use(protect, authorize('admin'));

router.get('/summary', getAuditDashboardSummary);
router.get('/logs', getAuditLogs);
router.get('/fraud-alerts', getFraudAlerts);
router.get('/fraud-alerts/summary', getFraudAlertsSummary);
router.patch('/fraud-alerts/:id/status', updateFraudAlertStatus);

module.exports = router;