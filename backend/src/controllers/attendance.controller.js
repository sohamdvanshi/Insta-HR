const { Attendance, Deployment, User } = require('../models');

const createAttendance = async (req, res) => {
  try {
    const employerId = req.user.id;

    const {
      deploymentId,
      attendanceDate,
      checkInTime,
      checkOutTime,
      status,
      remarks,
    } = req.body;

    if (!deploymentId || !attendanceDate || !status) {
      return res.status(400).json({
        success: false,
        message: 'Deployment, attendance date, and status are required.',
      });
    }

    const allowedStatuses = ['present', 'absent', 'half_day', 'leave', 'late'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance status.',
      });
    }

    const deployment = await Deployment.findOne({
      where: { id: deploymentId, employerId },
      attributes: ['id', 'candidateId', 'employerId', 'siteName'],
    });

    if (!deployment) {
      return res.status(400).json({
        success: false,
        message: 'Selected deployment does not exist.',
      });
    }

    const existingAttendance = await Attendance.findOne({
      where: {
        deploymentId,
        attendanceDate,
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this deployment on this date.',
      });
    }

    const attendance = await Attendance.create({
      employerId,
      deploymentId,
      candidateId: deployment.candidateId,
      attendanceDate,
      checkInTime: checkInTime || null,
      checkOutTime: checkOutTime || null,
      status,
      remarks: remarks || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Attendance marked successfully.',
      data: attendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark attendance.',
    });
  }
};

const getEmployerAttendance = async (req, res) => {
  try {
    const employerId = req.user.id;

    const attendance = await Attendance.findAll({
      where: { employerId },
      include: [
        {
          model: Deployment,
          as: 'deployment',
          attributes: ['id', 'siteName', 'location', 'startDate', 'status'],
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
      order: [['attendanceDate', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch attendance.',
    });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const { checkInTime, checkOutTime, status, remarks } = req.body;

    const allowedStatuses = ['present', 'absent', 'half_day', 'leave', 'late'];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance status.',
      });
    }

    const attendance = await Attendance.findOne({
      where: { id, employerId },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found.',
      });
    }

    if (status) attendance.status = status;
    if (typeof checkInTime !== 'undefined') attendance.checkInTime = checkInTime || null;
    if (typeof checkOutTime !== 'undefined') attendance.checkOutTime = checkOutTime || null;
    if (typeof remarks !== 'undefined') attendance.remarks = remarks || null;

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully.',
      data: attendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update attendance.',
    });
  }
};

module.exports = {
  createAttendance,
  getEmployerAttendance,
  updateAttendance,
};