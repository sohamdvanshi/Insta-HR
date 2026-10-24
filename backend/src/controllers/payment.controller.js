const Razorpay = require('razorpay');
const crypto = require('crypto');
const { subscriptionSnapshot, renderInvoice } = require('../services/invoiceDocument');
const { purchaseTerms, expiryFor } = require('../services/subscriptionTerms');
const { entitlementsFor } = require('../services/planEntitlements');
const { User, Payment, SubscriptionPlan, sequelize } = require('../models/index');
const { fail, USER_FIELDS } = require('../services/adminPolicy');
const { audit } = require('../services/adminOperations');

let razorpay;
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) fail('Payment service is not configured', 503);
  return razorpay ||= new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

exports.createOrder = async (req, res) => {
  try {
    if (typeof req.body?.plan !== 'string' || !['standard', 'premium', 'enterprise'].includes(req.body.plan)) fail('Choose an active paid plan');
    const details = await SubscriptionPlan.findByPk(req.body.plan);
    if (!details || !details.isActive || details.id === 'free') fail('Choose an active paid plan');
    const terms = purchaseTerms(details, req.body.billingCycle);
    expiryFor(req.user, details.id, terms.durationDays);
    const order = await getRazorpay().orders.create({ amount: terms.amountPaise, currency: details.currency,
      receipt: ('rcpt_' + req.user.id + '_' + Date.now()).substring(0, 40),
      notes: { userId: req.user.id, plan: details.id, planName: details.name } });
    await Payment.create({ userId: req.user.id, orderId: order.id, amount: terms.amountPaise / 100, currency: details.currency,
      plan: details.id, planName: details.name, billingCycle: terms.billingCycle, planDurationDays: terms.durationDays, status: 'created' });
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, plan: { name: details.name, amount: terms.amountPaise, currency: details.currency, duration: terms.durationDays } });
  } catch (error) {
    console.error('Create payment order:', error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to create payment order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if ([orderId, paymentId, signature].some(value => typeof value !== 'string' || !value || value.length > 200)) fail('Invalid payment verification');
    if (!process.env.RAZORPAY_KEY_SECRET) fail('Payment service is not configured', 503);
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) fail('Payment verification failed');
    const pending = await Payment.findOne({ where: { userId: req.user.id, orderId } });
    if (!pending) fail('No matching order exists. Start a new purchase or contact support.', 409);
    if (pending.status !== 'success') {
      const receipt = await getRazorpay().payments.fetch(paymentId);
      if (receipt.order_id !== orderId || receipt.status !== 'captured' || Number(receipt.amount) !== Math.round(Number(pending.amount) * 100) || receipt.currency !== pending.currency) fail('Payment has not been captured for the expected order. Contact support.', 409);
    }
    const result = await sequelize.transaction(async transaction => {
      const record = await Payment.findByPk(pending.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (record.status === 'success') {
        if (record.paymentId !== paymentId) fail('Order already settled with another payment', 409);
        return record;
      }
      if (!record.planDurationDays) fail('Order predates plan settings. Contact support.', 409);
      const buyer = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
      const expiresAt = expiryFor(buyer, record.plan, record.planDurationDays);
      const invoiceSnapshot = subscriptionSnapshot({ ...record.toJSON(), paymentId, expiresAt }, buyer);
      await record.update({ paymentId, status: 'success', expiresAt, invoiceSnapshot }, { transaction });
      await User.update({ subscriptionPlan: record.plan, subscriptionExpiry: expiresAt,
        subscriptionReminder7Sent: false, subscriptionReminder1Sent: false, subscriptionExpiredMailSent: false }, { where: { id: req.user.id }, transaction });
      await audit(req, transaction, 'payment.subscription_activated', 'payment', record.id, { plan: record.plan, amount: record.amount, expiresAt });
      return record;
    });
    const user = await User.findByPk(req.user.id, { attributes: USER_FIELDS });
    res.json({ success: true, message: 'Payment verified. Subscription activated.', plan: result.plan, expiresAt: result.expiresAt, user });
  } catch (error) {
    console.error('Payment verification:', error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to verify payment. Contact support before paying again.' });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: payments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'subscriptionPlan', 'subscriptionExpiry'],
    });

    const isActive =
      user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date();

    return res.json({
      success: true,
      data: {
        plan: isActive ? user.subscriptionPlan : 'free',
        expiresAt: user.subscriptionExpiry,
        isActive,
        entitlements: await entitlementsFor(user),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.downloadInvoice = async (req, res) => {
  try {
    const { id } = require('../services/adminPolicy');
    const payment = await sequelize.transaction(async transaction => {
      const record = await Payment.findOne({ where: { id: id(req.params.id), status: 'success', ...(['admin','super_admin'].includes(req.user.role) ? {} : { userId: req.user.id }) }, transaction, lock: transaction.LOCK.UPDATE });
      if (!record) fail('Payment not found', 404);
      if (!record.invoiceSnapshot) {
        const user = await User.findByPk(record.userId, { transaction });
        await record.update({ invoiceSnapshot: subscriptionSnapshot(record, user, new Date(record.updatedAt)) }, { transaction });
      }
      return record;
    });
    renderInvoice(res, payment.invoiceSnapshot, 'paid');
  } catch (e) { if (!res.headersSent) res.status(e.status || 500).json({ success: false, message: e.status ? e.message : 'Unable to download invoice' }); }
};

exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: payments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
