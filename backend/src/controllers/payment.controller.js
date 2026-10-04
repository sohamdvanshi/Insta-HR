const Razorpay = require('razorpay');
const { PLANS, canBuyPlan, validSignature, validateGatewayPayment } = require('../services/subscriptionPaymentPolicy');
const PDFDocument = require('pdfkit');
const { User, Payment, sequelize } = require('../models/index');

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
    const { plan } = req.body;

    if (!canBuyPlan(req.user, plan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan',
      });
    }

    const planDetails = PLANS[plan];

    const order = await razorpay.orders.create({
      amount: planDetails.amount,
      currency: planDetails.currency,
      receipt: ('rcpt_' + req.user.id + '_' + Date.now()).substring(0, 40),
      notes: {
        userId: String(req.user.id),
        plan,
        planName: planDetails.name,
      },
    });

    return res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
      plan: planDetails,
    });
  } catch (err) {
    console.error('Razorpay createOrder error:', err);
    return res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Failed to create order',
    });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, plan: requestedPlan } = req.body;
    if (!validSignature({ orderId, paymentId, signature, secret: process.env.RAZORPAY_KEY_SECRET })) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
    const [order, gatewayPayment] = await Promise.all([razorpay.orders.fetch(orderId), razorpay.payments.fetch(paymentId)]);
    const verified = validateGatewayPayment({ user: req.user, order, payment: gatewayPayment, requestedPlan });
    if (!verified) return res.status(400).json({ success: false, message: 'Payment is not captured or does not match your account, plan, or amount. Please contact support if charged.' });
    const result = await sequelize.transaction(async transaction => {
      const user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
      const existing = await Payment.findOne({ where: { orderId, userId: user.id, status: 'success' }, transaction });
      if (existing) return { plan: existing.plan, expiresAt: existing.expiresAt, user };
      const expiresAt = new Date(Math.max(Date.now(), new Date(user.subscriptionExpiry || 0).getTime() || 0));
      expiresAt.setDate(expiresAt.getDate() + verified.details.duration);
      await Payment.create({ userId: user.id, orderId, paymentId, amount: verified.details.amount / 100, currency: verified.details.currency, plan: verified.plan, planName: verified.details.name, status: 'success', expiresAt }, { transaction });
      await user.update({ subscriptionPlan: verified.plan, subscriptionExpiry: expiresAt, subscriptionReminder7Sent: false, subscriptionReminder1Sent: false, subscriptionExpiredMailSent: false }, { transaction });
      return { plan: verified.plan, expiresAt, user };
    });
    return res.json({ success: true, message: 'Subscription activated.', plan: result.plan, expiresAt: result.expiresAt, user: { id: result.user.id, email: result.user.email, role: result.user.role, referralCode: result.user.referralCode, subscriptionPlan: result.user.subscriptionPlan, subscriptionExpiry: result.user.subscriptionExpiry } });
  } catch (error) {
    console.error('Payment verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify payment. Retry verification or contact support if charged.' });
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