const Razorpay = require('razorpay');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { User, Payment, SubscriptionPlan, sequelize } = require('../models/index');
const { fail, USER_FIELDS } = require('../services/adminPolicy');
const { audit } = require('../services/adminOperations');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const formatCurrency = amount => {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
};

const formatDate = date => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

exports.createOrder = async (req, res) => {
  try {
    if (typeof req.body?.plan !== 'string' || !['standard', 'premium', 'enterprise'].includes(req.body.plan)) fail('Choose an active paid plan');
    const details = await SubscriptionPlan.findByPk(req.body.plan);
    if (!details || !details.isActive || details.id === 'free') fail('Choose an active paid plan');
    const order = await razorpay.orders.create({ amount: details.amountPaise, currency: details.currency,
      receipt: ('rcpt_' + req.user.id + '_' + Date.now()).substring(0, 40),
      notes: { userId: req.user.id, plan: details.id, planName: details.name } });
    await Payment.create({ userId: req.user.id, orderId: order.id, amount: details.amountPaise / 100, currency: details.currency,
      plan: details.id, planName: details.name, planDurationDays: details.durationDays, status: 'created' });
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, plan: { name: details.name, amount: details.amountPaise, currency: details.currency, duration: details.durationDays } });
  } catch (error) {
    console.error('Create payment order:', error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to create payment order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if ([orderId, paymentId, signature].some(value => typeof value !== 'string' || !value || value.length > 200)) fail('Invalid payment verification');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) fail('Payment verification failed');
    const pending = await Payment.findOne({ where: { userId: req.user.id, orderId } });
    if (!pending) fail('No matching order exists. Start a new purchase or contact support.', 409);
    if (pending.status !== 'success') {
      const receipt = await razorpay.payments.fetch(paymentId);
      if (receipt.order_id !== orderId || receipt.status !== 'captured' || Number(receipt.amount) !== Math.round(Number(pending.amount) * 100) || receipt.currency !== pending.currency) fail('Payment has not been captured for the expected order. Contact support.', 409);
    }
    const result = await sequelize.transaction(async transaction => {
      const record = await Payment.findByPk(pending.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (record.status === 'success') {
        if (record.paymentId !== paymentId) fail('Order already settled with another payment', 409);
        return record;
      }
      if (!record.planDurationDays) fail('Order predates plan settings. Contact support.', 409);
      const expiresAt = new Date(Date.now() + record.planDurationDays * 86400000);
      await record.update({ paymentId, status: 'success', expiresAt }, { transaction });
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
    const { id } = req.params;

    const payment = await Payment.findOne({
      where: {
        id,
        userId: req.user.id,
        status: 'success',
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email'],
    });

    const invoiceNumber = `INV-${payment.id}-${new Date(payment.createdAt).getFullYear()}`;
    const gstRate = 0.18;
    const totalAmount = Number(payment.amount);
    const taxableAmount = totalAmount / (1 + gstRate);
    const gstAmount = totalAmount - taxableAmount;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${payment.id}.pdf`
    );

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc
      .fontSize(24)
      .fillColor('#111827')
      .text('InstaHire', 50, 45)
      .fontSize(11)
      .fillColor('#6B7280')
      .text('Subscription Invoice', 50, 75);

    doc
      .fontSize(20)
      .fillColor('#111827')
      .text('INVOICE', 400, 45, { align: 'right' })
      .fontSize(10)
      .fillColor('#4B5563')
      .text(`Invoice No: ${invoiceNumber}`, 340, 75, { align: 'right' })
      .text(`Invoice Date: ${formatDate(payment.createdAt)}`, 340, 90, { align: 'right' });

    doc
      .moveTo(50, 120)
      .lineTo(550, 120)
      .strokeColor('#E5E7EB')
      .stroke();

    doc
      .fontSize(12)
      .fillColor('#111827')
      .text('Billed To', 50, 140)
      .fontSize(10)
      .fillColor('#4B5563')
      .text(user?.name || 'Employer', 50, 160)
      .text(user?.email || '-', 50, 175);

    doc
      .fontSize(12)
      .fillColor('#111827')
      .text('Payment Details', 340, 140)
      .fontSize(10)
      .fillColor('#4B5563')
      .text(`Plan: ${payment.planName}`, 340, 160)
      .text(`Order ID: ${payment.orderId}`, 340, 175)
      .text(`Payment ID: ${payment.paymentId}`, 340, 190)
      .text(`Status: ${payment.status}`, 340, 205)
      .text(`Valid Until: ${formatDate(payment.expiresAt)}`, 340, 220);

    const tableTop = 280;

    doc
      .rect(50, tableTop, 500, 28)
      .fill('#F3F4F6');

    doc
      .fillColor('#111827')
      .fontSize(10)
      .text('Description', 60, tableTop + 9)
      .text('Qty', 300, tableTop + 9, { width: 40, align: 'center' })
      .text('Unit Price', 370, tableTop + 9, { width: 70, align: 'right' })
      .text('Amount', 460, tableTop + 9, { width: 70, align: 'right' });

    const rowY = tableTop + 40;

    doc
      .fillColor('#374151')
      .fontSize(10)
      .text(`${payment.planName} Subscription`, 60, rowY)
      .text('1', 300, rowY, { width: 40, align: 'center' })
      .text(formatCurrency(taxableAmount.toFixed(2)), 370, rowY, { width: 70, align: 'right' })
      .text(formatCurrency(taxableAmount.toFixed(2)), 460, rowY, { width: 70, align: 'right' });

    doc
      .moveTo(50, rowY + 25)
      .lineTo(550, rowY + 25)
      .strokeColor('#E5E7EB')
      .stroke();

    const totalsY = rowY + 60;

    doc
      .fontSize(10)
      .fillColor('#4B5563')
      .text('Subtotal', 380, totalsY, { width: 80, align: 'right' })
      .text(formatCurrency(taxableAmount.toFixed(2)), 460, totalsY, {
        width: 70,
        align: 'right',
      })
      .text('GST (18%)', 380, totalsY + 20, { width: 80, align: 'right' })
      .text(formatCurrency(gstAmount.toFixed(2)), 460, totalsY + 20, {
        width: 70,
        align: 'right',
      });

    doc
      .moveTo(380, totalsY + 45)
      .lineTo(530, totalsY + 45)
      .strokeColor('#9CA3AF')
      .stroke();

    doc
      .fontSize(12)
      .fillColor('#111827')
      .text('Total', 380, totalsY + 55, { width: 80, align: 'right' })
      .text(formatCurrency(totalAmount.toFixed(2)), 460, totalsY + 55, {
        width: 70,
        align: 'right',
      });

    doc
      .fontSize(10)
      .fillColor('#6B7280')
      .text(
        'This is a system-generated invoice for your InstaHire subscription purchase.',
        50,
        700,
        { align: 'center', width: 500 }
      )
      .text(
        'For support, contact support@instahire.com',
        50,
        715,
        { align: 'center', width: 500 }
      );

    doc.end();
  } catch (err) {
    console.error('downloadInvoice error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
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
