const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth');
router.get('/plans', require('../controllers/adminWorkspace.controller').publicPlans);

router.post('/create-order', protect, authorize('employer'), paymentController.createOrder);
router.post('/verify', protect, authorize('employer'), paymentController.verifyPayment);
router.get('/history', protect, paymentController.getPaymentHistory);
router.get('/subscription', protect, paymentController.getSubscription);
router.get('/:id/invoice', protect, paymentController.downloadInvoice);

module.exports = router;
