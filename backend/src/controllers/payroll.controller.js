const { Payroll, Attendance, Deployment, User } = require('../models');
const { Op } = require('sequelize');

const { monthRange: getMonthRange, money } = require('../services/recordValidation');

const calculateNetSalary = (grossSalary, deductions, bonus) => {
  const gross = Number(grossSalary || 0);
  const deduct = Number(deductions || 0);
  const extra = Number(bonus || 0);
  return Math.max(Math.round(gross * 100) - Math.round(deduct * 100) + Math.round(extra * 100), 0) / 100;
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

    getMonthRange(payPeriodMonth);
    const gross = money(grossSalary), deduct = money(deductions, true), extra = money(bonus, true);

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

    const netSalary = calculateNetSalary(gross, deduct, extra);

    const payroll = await Payroll.create({
      employerId,
      deploymentId,
      candidateId: deployment.candidateId,
      payPeriodMonth,
      totalPresentDays,
      totalAbsentDays,
      totalHalfDays,
      grossSalary: gross,
      deductions: deduct,
      bonus: extra,
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
    return res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
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
    return res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
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
    return res.status(error.status || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500)).json({
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