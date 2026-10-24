const { fail, id } = require('../services/adminPolicy');
const { audit } = require('../services/adminOperations');
const { validateTransition } = require('../services/invoicePolicy');
const { renderInvoice } = require('../services/invoiceDocument');
const { Invoice, Payroll, Deployment, User, sequelize } = require('../models');

const { randomUUID } = require('crypto');
const { monthRange, dateRange, money } = require('../services/recordValidation');
const generateInvoiceNumber = () => `INV-${Date.now()}-${randomUUID()}`;

const calculateTotal = (subtotal, taxAmount) => {
  return Math.round((Number(subtotal || 0) + Number(taxAmount || 0)) * 100) / 100;
};

const createInvoice = async (req, res) => {
  try {
    const employerId = req.user.id;
    const {
      deploymentId,
      payrollId,
      billingPeriodMonth,
      invoiceDate,
      dueDate,
      subtotal,
      taxAmount,
      paymentTerms,
      remarks,
    } = req.body;

    if (!deploymentId || !billingPeriodMonth || !invoiceDate || !dueDate || subtotal === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Deployment, billing period, invoice date, due date, and subtotal are required.',
      });
    }

    monthRange(billingPeriodMonth);
    dateRange(invoiceDate, dueDate);
    const subtotalValue = money(subtotal), taxValue = money(taxAmount, true);

    const deployment = await Deployment.findOne({
      where: { id: deploymentId, employerId },
      attributes: ['id', 'candidateId', 'siteName'],
    });

    if (!deployment) {
      return res.status(400).json({
        success: false,
        message: 'Selected deployment does not exist.',
      });
    }

    const existingInvoice = await Invoice.findOne({
      where: { deploymentId, billingPeriodMonth },
    });

    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this deployment and billing month.',
      });
    }

    let linkedPayrollId = null;

    if (payrollId) {
      const payroll = await Payroll.findOne({
        where: { id: payrollId, employerId, deploymentId },
      });

      if (!payroll) {
        return res.status(400).json({
          success: false,
          message: 'Selected payroll record does not exist for this deployment.',
        });
      }

      linkedPayrollId = payroll.id;
    }

    const totalAmount = calculateTotal(subtotalValue, taxValue);

    const employer = await User.findByPk(employerId, { attributes: ['id','email'] });
    const invoiceNumber = generateInvoiceNumber();
    const invoice = await sequelize.transaction(async transaction => {
    const created = await Invoice.create({
      employerId,
      deploymentId,
      candidateId: deployment.candidateId,
      payrollId: linkedPayrollId,
      invoiceNumber,
      invoiceSnapshot: { number: invoiceNumber, date: invoiceDate, dueDate, seller: process.env.BILLING_SELLER_NAME || 'Insta-HR', sellerAddress: process.env.BILLING_SELLER_ADDRESS || '', sellerTaxId: process.env.BILLING_SELLER_TAX_ID || '', buyer: employer.email, description: `Deployment ${deployment.id} at ${deployment.siteName} — ${billingPeriodMonth}`, currency: 'INR', subtotal: subtotalValue, tax: taxValue, total: totalAmount, terms: paymentTerms || 'Net 30' },
      billingPeriodMonth,
      invoiceDate,
      dueDate,
      subtotal: subtotalValue,
      taxAmount: taxValue,
      totalAmount,
      paymentTerms: paymentTerms || 'Net 30',
      status: 'draft',
      remarks: remarks || null,
    }, { transaction });
    await audit(req, transaction, 'invoice.created', 'invoice', created.id, { invoiceNumber, totalAmount });
    return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      data: invoice,
    });
  } catch (error) {
    return res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
      success: false,
      message: error.message || 'Failed to create invoice.',
    });
  }
};

const getEmployerInvoices = async (req, res) => {
  try {
    const employerId = req.user.id;

    const invoices = await Invoice.findAll({
      where: { employerId },
      include: [
        {
          model: Deployment,
          as: 'deployment',
          attributes: ['id', 'siteName', 'location', 'status'],
          include: [
            {
              model: User,
              as: 'candidate',
              attributes: ['id', 'email'],
            },
          ],
        },
        {
          model: Payroll,
          as: 'payroll',
          required: false,
          attributes: ['id', 'payPeriodMonth', 'netSalary', 'status'],
        },
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email'],
        },
      ],
      order: [['billingPeriodMonth', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    return res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
      success: false,
      message: error.message || 'Failed to fetch invoices.',
    });
  }
};

const updateInvoiceStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const invoice = await sequelize.transaction(async transaction => {
      const record = await Invoice.findOne({ where: { id: require('../services/adminPolicy').id(id), employerId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!record) fail('Invoice record not found', 404);
      validateTransition(record, status);
      if (record.status !== status) {
        const before = record.status;
        await record.update({ status }, { transaction });
        await audit(req, transaction, 'invoice.status', 'invoice', record.id, { before, status });
      }
      return record;
    });

    return res.status(200).json({
      success: true,
      message: 'Invoice status updated successfully.',
      data: invoice,
    });
  } catch (error) {
    return res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
      success: false,
      message: error.message || 'Failed to update invoice status.',
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const invoice = await sequelize.transaction(async transaction => {
      const record = await Invoice.findOne({ where: { id: id(req.params.id), ...(['admin','super_admin'].includes(req.user.role) ? {} : { employerId: req.user.id }) }, transaction, lock: transaction.LOCK.UPDATE });
      if (!record) fail('Invoice record not found', 404);
      if (!record.invoiceSnapshot) {
        const employer = await User.findByPk(record.employerId, { attributes: ['id','email'], transaction });
        await record.update({ invoiceSnapshot: { number: record.invoiceNumber, date: record.invoiceDate, dueDate: record.dueDate, seller: process.env.BILLING_SELLER_NAME || 'Insta-HR', buyer: employer?.email || record.employerId, description: `Deployment ${record.deploymentId} — ${record.billingPeriodMonth}`, currency: 'INR', subtotal: Number(record.subtotal), tax: Number(record.taxAmount), total: Number(record.totalAmount), terms: record.paymentTerms } }, { transaction });
      }
      return record;
    });
    renderInvoice(res, invoice.invoiceSnapshot, invoice.status);
  } catch (error) { if (!res.headersSent) res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to download invoice' }); }
};

module.exports = {
  downloadInvoice,
  createInvoice,
  getEmployerInvoices,
  updateInvoiceStatus,
};