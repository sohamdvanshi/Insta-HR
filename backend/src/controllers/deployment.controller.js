const { Deployment, User, ManpowerRequest } = require('../models');

const createDeployment = async (req, res) => {
  try {
    const employerId = req.user.id;

    const {
      manpowerRequestId,
      candidateId,
      siteName,
      location,
      reportingManager,
      startDate,
      endDate,
      shiftType,
      salaryOffered,
      billingRate,
      notes,
    } = req.body;

    if (!candidateId || !siteName || !location || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Candidate, site name, location, and start date are required.',
      });
    }

    const candidate = await User.findOne({
      where: {
        id: candidateId,
        role: 'candidate',
      },
      attributes: ['id', 'email', 'role'],
    });

    if (!candidate) {
      return res.status(400).json({
        success: false,
        message: 'Selected candidate does not exist.',
      });
    }

    let manpowerRequest = null;

    if (manpowerRequestId) {
      manpowerRequest = await ManpowerRequest.findOne({
        where: {
          id: manpowerRequestId,
          employerId,
        },
        attributes: ['id', 'jobTitle', 'employerId'],
      });

      if (!manpowerRequest) {
        return res.status(400).json({
          success: false,
          message: 'Selected manpower request does not exist.',
        });
      }
    }

    const deployment = await Deployment.create({
      employerId,
      manpowerRequestId: manpowerRequestId || null,
      candidateId,
      siteName,
      location,
      reportingManager: reportingManager || null,
      startDate,
      endDate: endDate || null,
      shiftType: shiftType || 'general',
      salaryOffered: salaryOffered || null,
      billingRate: billingRate || null,
      notes: notes || null,
      status: 'assigned',
    });

    return res.status(201).json({
      success: true,
      message: 'Deployment created successfully.',
      data: deployment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create deployment.',
    });
  }
};

const getEmployerDeployments = async (req, res) => {
  try {
    const employerId = req.user.id;

    const deployments = await Deployment.findAll({
      where: { employerId },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email'],
        },
        {
          model: ManpowerRequest,
          as: 'manpowerRequest',
          attributes: ['id', 'jobTitle', 'location', 'status'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: deployments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch deployments.',
    });
  }
};

const updateDeploymentStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['assigned', 'active', 'completed', 'cancelled', 'on_hold'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deployment status.',
      });
    }

    const deployment = await Deployment.findOne({
      where: { id, employerId },
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found.',
      });
    }

    deployment.status = status;
    await deployment.save();

    return res.status(200).json({
      success: true,
      message: 'Deployment status updated successfully.',
      data: deployment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update deployment status.',
    });
  }
};

module.exports = {
  createDeployment,
  getEmployerDeployments,
  updateDeploymentStatus,
};