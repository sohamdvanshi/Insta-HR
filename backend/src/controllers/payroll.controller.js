const { Payroll, Attendance, Deployment, User } = require('../models');
const { Op } = require('sequelize');

const getMonthRange = (payPeriodMonth) => {
  const [year, month] = payPeriodMonth.split('-').map(Number);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  return { startDate, endDate };
};

const calculateNetSalary = (grossSalary, deductions, bonus) => {
  const gross = Number(grossSalary || 0);
  const deduct = Number(deductions || 0);
  const extra = Number(bonus || 0);
  return Math.max(gross - deduct + extra, 0);
};

const createPayroll = async (req, res) => {
  try {
    const employerId = req.user.id;
    const {
      deploymentId,
      payPeriodMonth,
      grossSalary,
      deductions,
      bonus,
      remarks,
    } = req.body;

    if (!deploymentId || !payPeriodMonth || grossSalary === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Deployment, pay period month, and gross salary are required.',
      });
    }

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

    const existingPayroll = await Payroll.findOne({
      where: { deploymentId, payPeriodMonth },
    });

    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: 'Payroll already exists for this deployment and month.',
      });
    }

    const { startDate, endDate } = getMonthRange(payPeriodMonth);

    const attendanceRecords = await Attendance.findAll({
      where: {
        deploymentId,
        attendanceDate: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: ['status'],
    });

    const totalPresentDays = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
    const totalAbsentDays = attendanceRecords.filter(a => a.status === 'absent').length;
    const totalHalfDays = attendanceRecords.filter(a => a.status === 'half_day').length;

    const netSalary = calculateNetSalary(grossSalary, deductions, bonus);

    const payroll = await Payroll.create({
      employerId,
      deploymentId,
      candidateId: deployment.candidateId,
      payPeriodMonth,
      totalPresentDays,
      totalAbsentDays,
      totalHalfDays,
      grossSalary,
      deductions: deductions || 0,
      bonus: bonus || 0,
      netSalary,
      status: 'draft',
      remarks: remarks || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Payroll created successfully.',
      data: payroll,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payroll.',
    });
  }
};

const getEmployerPayrolls = async (req, res) => {
  try {
    const employerId = req.user.id;

    const payrolls = await Payroll.findAll({
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
          model: User,
          as: 'candidate',
          attributes: ['id', 'email'],
        },
      ],
      order: [['payPeriodMonth', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payrolls.',
    });
  }
};

const updatePayrollStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['draft', 'processed', 'paid'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll status.',
      });
    }

    const payroll = await Payroll.findOne({
      where: { id, employerId },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found.',
      });
    }

    payroll.status = status;
    await payroll.save();

    return res.status(200).json({
      success: true,
      message: 'Payroll status updated successfully.',
      data: payroll,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update payroll status.',
    });
  }
};

module.exports = {
  createPayroll,
  getEmployerPayrolls,
  updatePayrollStatus,
};