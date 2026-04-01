const Razorpay = require('razorpay');
const crypto = require('crypto');
const { User, Payment } = require('../models/index');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = {
  standard:   { name: 'Standard Plan',   amount: 199900, currency: 'INR', duration: 30 },
  premium:    { name: 'Premium Plan',     amount: 399900, currency: 'INR', duration: 30 },
  enterprise: { name: 'Enterprise Plan',  amount: 999900, currency: 'INR', duration: 30 },
};

// Create Razorpay order
exports.createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const planDetails = PLANS[plan];
    const order = await razorpay.orders.create({
      amount: planDetails.amount,
      currency: planDetails.currency,
      receipt: ('rcpt_' + req.user.id + '_' + Date.now()).substring(0, 40),
      notes: { userId: String(req.user.id), plan, planName: planDetails.name },
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
      plan: planDetails,
    });
  } catch (err) {
    console.error('Razorpay createOrder error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.error?.description || err.message || 'Failed to create order'
    });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const planDetails = PLANS[plan];
    if (!planDetails) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + planDetails.duration);

    await Payment.create({
      userId: req.user.id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: planDetails.amount / 100,
      currency: 'INR',
      plan,
      planName: planDetails.name,
      status: 'success',
      expiresAt,
    });

    await User.update(
      { subscriptionPlan: plan, subscriptionExpiry: expiresAt },
      { where: { id: req.user.id } }
    );

    res.json({
      success: true,
      message: 'Payment verified! Subscription activated.',
      plan,
      expiresAt,
    });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get payment history
exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get current subscription
exports.getSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'subscriptionPlan', 'subscriptionExpiry'],
    });
    const isActive = user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date();
    res.json({
      success: true,
      data: {
        plan: isActive ? user.subscriptionPlan : 'free',
        expiresAt: user.subscriptionExpiry,
        isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: all payments
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
