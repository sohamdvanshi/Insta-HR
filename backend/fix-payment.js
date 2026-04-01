const fs = require('fs');

const controller = `const Razorpay = require('razorpay');
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
      receipt: 'rcpt_' + req.user.id + '_' + Date.now(),
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
`;

fs.writeFileSync('src/controllers/payment.controller.js', controller);
console.log('✅ Payment controller updated');

// Check if Payment model exists, create if not
if (!fs.existsSync('src/models/Payment.js')) {
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
  status: { type: DataTypes.ENUM('created', 'success', 'failed'), defaultValue: 'created' },
  expiresAt: { type: DataTypes.DATE },
}, { tableName: 'Payments', timestamps: true });

module.exports = Payment;
`;
  fs.writeFileSync('src/models/Payment.js', paymentModel);
  console.log('✅ Payment model created');
}

// Make sure Payment is in index.js
let indexContent = fs.readFileSync('src/models/index.js', 'utf8');
if (!indexContent.includes("require('./Payment')")) {
  // find last require line and add after it
  indexContent = indexContent.replace(
    /const EmployerProfile = require\('.\/EmployerProfile'\);/,
    `const EmployerProfile = require('./EmployerProfile');\nconst Payment = require('./Payment');`
  );
  if (!indexContent.includes("require('./Payment')")) {
    // fallback: add before module.exports
    indexContent = indexContent.replace(
      'module.exports = {',
      `const Payment = require('./Payment');\n\nmodule.exports = {`
    );
  }
  indexContent = indexContent.replace(
    'module.exports = {',
    'module.exports = {\n  Payment,'
  );
  fs.writeFileSync('src/models/index.js', indexContent);
  console.log('✅ Payment added to index.js');
} else {
  console.log('ℹ️  Payment already in index.js');
}

// Make sure subscriptionExpiry is in User model
let userModel = fs.readFileSync('src/models/User.js', 'utf8');
if (!userModel.includes('subscriptionExpiry')) {
  userModel = userModel.replace(
    'subscriptionPlan:',
    `subscriptionExpiry: {
    type: DataTypes.DATE,
  },
  subscriptionPlan:`
  );
  fs.writeFileSync('src/models/User.js', userModel);
  console.log('✅ subscriptionExpiry added to User model');
} else {
  console.log('ℹ️  subscriptionExpiry already in User model');
}

// Make sure payment routes registered in server.js
let server = fs.readFileSync('src/server.js', 'utf8');
if (!server.includes('payment.routes')) {
  server = server.replace(
    "app.use('/api/v1/employers'",
    `app.use('/api/v1/payments', require('./routes/payment.routes'));\napp.use('/api/v1/employers'`
  );
  fs.writeFileSync('src/server.js', server);
  console.log('✅ Payment routes registered in server.js');
} else {
  console.log('ℹ️  Payment routes already registered');
}

// Make sure payment routes file exists
if (!fs.existsSync('src/routes/payment.routes.js')) {
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
  console.log('✅ Payment routes file created');
} else {
  console.log('ℹ️  Payment routes file already exists');
}

console.log('\n✅ All done! Now run:');
console.log('   npm install razorpay');
console.log('   npm run dev');