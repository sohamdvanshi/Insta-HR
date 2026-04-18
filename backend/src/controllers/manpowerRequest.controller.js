const { ManpowerRequest } = require('../models');

const createManpowerRequest = async (req, res) => {
  try {
    const employerId = req.user.id;

    const {
      jobTitle,
      department,
      headcountRequired,
      location,
      shiftType,
      employmentType,
      contractDuration,
      salaryBudget,
      billingType,
      startDate,
      skillsRequired,
      experienceRequired,
      notes,
    } = req.body;

    if (!jobTitle || !location || !headcountRequired) {
      return res.status(400).json({
        success: false,
        message: 'Job title, headcount required, and location are required.',
      });
    }

    const request = await ManpowerRequest.create({
      employerId,
      jobTitle,
      department,
      headcountRequired,
      location,
      shiftType,
      employmentType,
      contractDuration,
      salaryBudget,
      billingType,
      startDate,
      skillsRequired,
      experienceRequired,
      notes,
      status: 'open',
    });

    return res.status(201).json({
      success: true,
      message: 'Manpower request created successfully.',
      data: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create manpower request.',
    });
  }
};

const getEmployerManpowerRequests = async (req, res) => {
  try {
    const employerId = req.user.id;

    const requests = await ManpowerRequest.findAll({
      where: { employerId },
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch manpower requests.',
    });
  }
};

const updateManpowerRequestStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['open', 'in_progress', 'fulfilled', 'closed', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value.',
      });
    }

    const request = await ManpowerRequest.findOne({
      where: { id, employerId },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Manpower request not found.',
      });
    }

    request.status = status;
    await request.save();

    return res.status(200).json({
      success: true,
      message: 'Status updated successfully.',
      data: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update manpower request status.',
    });
  }
};

module.exports = {
  createManpowerRequest,
  getEmployerManpowerRequests,
  updateManpowerRequestStatus,
};