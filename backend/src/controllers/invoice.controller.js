const { Invoice, Payroll, Deployment, User } = require('../models');

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

    const invoice = await Invoice.create({
      employerId,
      deploymentId,
      candidateId: deployment.candidateId,
      payrollId: linkedPayrollId,
      invoiceNumber: generateInvoiceNumber(),
      billingPeriodMonth,
      invoiceDate,
      dueDate,
      subtotal: subtotalValue,
      taxAmount: taxValue,
      totalAmount,
      paymentTerms: paymentTerms || 'Net 30',
      status: 'draft',
      remarks: remarks || null,
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

    const allowedStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice status.',
      });
    }

    const invoice = await Invoice.findOne({
      where: { id, employerId },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice record not found.',
      });
    }

    invoice.status = status;
    await invoice.save();

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

module.exports = {
  createInvoice,
  getEmployerInvoices,
  updateInvoiceStatus,
};