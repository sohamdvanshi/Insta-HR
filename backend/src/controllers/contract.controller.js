const { Contract, Deployment, User } = require('../models');

const createContract = async (req, res) => {
  try {
    const employerId = req.user.id;

    const {
      deploymentId,
      contractTitle,
      contractType,
      startDate,
      endDate,
      renewalDate,
      billingType,
      billingRate,
      documentUrl,
      notes,
    } = req.body;

    if (!contractTitle || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Contract title and start date are required.',
      });
    }

    if (deploymentId) {
      const deployment = await Deployment.findOne({
        where: { id: deploymentId, employerId },
      });

      if (!deployment) {
        return res.status(400).json({
          success: false,
          message: 'Selected deployment does not exist.',
        });
      }
    }

    const contract = await Contract.create({
      employerId,
      deploymentId: deploymentId || null,
      contractTitle,
      contractType: contractType || 'staffing',
      startDate,
      endDate: endDate || null,
      renewalDate: renewalDate || null,
      billingType: billingType || 'monthly',
      billingRate: billingRate || null,
      documentUrl: documentUrl || null,
      notes: notes || null,
      status: 'draft',
    });

    return res.status(201).json({
      success: true,
      message: 'Contract created successfully.',
      data: contract,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create contract.',
    });
  }
};

const getEmployerContracts = async (req, res) => {
  try {
    const employerId = req.user.id;

    const contracts = await Contract.findAll({
      where: { employerId },
      include: [
        {
          model: Deployment,
          as: 'deployment',
          required: false,
          include: [
            {
              model: User,
              as: 'candidate',
              attributes: ['id', 'email'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: contracts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch contracts.',
    });
  }
};

const updateContractStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['draft', 'active', 'expired', 'renewed', 'terminated'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contract status.',
      });
    }

    const contract = await Contract.findOne({
      where: { id, employerId },
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found.',
      });
    }

    contract.status = status;
    await contract.save();

    return res.status(200).json({
      success: true,
      message: 'Contract status updated successfully.',
      data: contract,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update contract status.',
    });
  }
};

module.exports = {
  createContract,
  getEmployerContracts,
  updateContractStatus,
};