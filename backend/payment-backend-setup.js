const fs = require('fs');

// ─── 1. PAYMENT CONTROLLER ───
const controller = `const Razorpay = require('razorpay');
const crypto = require('crypto');
const { User, Payment } = require('../models/index');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = {
  standard: { name: 'Standard Plan', amount: 199900, currency: 'INR', duration: 30 },  // ₹1999/month
  premium:  { name: 'Premium Plan',  amount: 399900, currency: 'INR', duration: 30 },  // ₹3999/month
  enterprise: { name: 'Enterprise Plan', amount: 999900, currency: 'INR', duration: 30 }, // ₹9999/month
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
      receipt: 'receipt_' + req.user.id + '_' + Date.now(),
      notes: {
        userId: req.user.id,
        plan,
        planName: planDetails.name,
      },
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
      plan: planDetails,
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Verify payment after Razorpay callback
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const planDetails = PLANS[plan];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + planDetails.duration);

    // Save payment record
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

    // Update user subscription
    await User.update(
      { subscriptionPlan: plan, subscriptionExpiry: expiresAt },
      { where: { id: req.user.id } }
    );

    res.json({
      success: true,
      message: 'Payment successful! Subscription activated.',
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

// Get current subscription status
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
`;
fs.mkdirSync('src/controllers', { recursive: true });
fs.writeFileSync('src/controllers/payment.controller.js', controller);
console.log('✅ Payment controller created');

// ─── 2. PAYMENT MODEL ───
const paymentModel = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.STRING, allowNull: false },
  paymentId: { type: DataTypes.STRING },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  currency: { type: DataTypes.STRING, defaultValue: 'INR' },
  plan: { type: DataTypes.ENUM('standard', 'premium', 'enterprise'), allowNull: false },
  planName: { type: DataTypes.STRING },
  status: {
    type: DataTypes.ENUM('created', 'success', 'failed'),
    defaultValue: 'created',
  },
  expiresAt: { type: DataTypes.DATE },
}, { tableName: 'Payments', timestamps: true });

module.exports = Payment;
`;
fs.writeFileSync('src/models/Payment.js', paymentModel);
console.log('✅ Payment model created');

// ─── 3. PAYMENT ROUTES ───
const routes = `const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/create-order', protect, authorize('employer'), paymentController.createOrder);
router.post('/verify', protect, authorize('employer'), paymentController.verifyPayment);
router.get('/history', protect, authorize('employer'), paymentController.getPaymentHistory);
router.get('/subscription', protect, paymentController.getSubscription);
router.get('/all', protect, authorize('admin'), paymentController.getAllPayments);

module.exports = router;
`;
fs.writeFileSync('src/routes/payment.routes.js', routes);
console.log('✅ Payment routes created');

// ─── 4. UPDATE index.js with Payment model ───
let indexContent = fs.readFileSync('src/models/index.js', 'utf8');
if (!indexContent.includes('Payment')) {
  indexContent = indexContent.replace(
    "const EmployerProfile = require('./EmployerProfile');",
    "const EmployerProfile = require('./EmployerProfile');\nconst Payment = require('./Payment');"
  );
  indexContent = indexContent.replace(
    "module.exports = {",
    "module.exports = {\n  Payment,"
  );
  fs.writeFileSync('src/models/index.js', indexContent);
  console.log('✅ index.js updated with Payment model');
} else {
  console.log('ℹ️  Payment already in index.js');
}

// ─── 5. UPDATE User model with subscriptionExpiry ───
let userModel = fs.readFileSync('src/models/User.js', 'utf8');
if (!userModel.includes('subscriptionExpiry')) {
  userModel = userModel.replace(
    "subscriptionPlan: {",
    `subscriptionExpiry: {
    type: DataTypes.DATE,
  },
  subscriptionPlan: {`
  );
  fs.writeFileSync('src/models/User.js', userModel);
  console.log('✅ User model updated with subscriptionExpiry');
} else {
  console.log('ℹ️  subscriptionExpiry already in User model');
}

// ─── 6. Register route in server.js ───
let serverContent = fs.readFileSync('src/server.js', 'utf8');
if (!serverContent.includes('payment.routes')) {
  serverContent = serverContent.replace(
    "app.use('/api/v1/employers', require('./routes/employer.routes'));",
    "app.use('/api/v1/employers', require('./routes/employer.routes'));\napp.use('/api/v1/payments', require('./routes/payment.routes'));"
  );
  fs.writeFileSync('src/server.js', serverContent);
  console.log('✅ Payment routes registered in server.js');
} else {
  console.log('ℹ️  Payment routes already in server.js');
}

console.log('\n📦 Now install Razorpay SDK:');
console.log('   npm install razorpay');
console.log('\n🔑 Add to your .env file:');
console.log('   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx');
console.log('   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx');
console.log('\n🔄 Then restart backend: npm run dev');