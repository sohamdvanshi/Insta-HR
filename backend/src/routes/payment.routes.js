const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');

router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify', protect, paymentController.verifyPayment);
router.get('/history', protect, paymentController.getPaymentHistory);
router.get('/subscription', protect, paymentController.getSubscription);
router.get('/:id/invoice', protect, paymentController.downloadInvoice);

module.exports = router;