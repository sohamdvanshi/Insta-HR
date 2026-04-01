const { Op } = require('sequelize');
const { Job, User } = require('../models');

const toArray = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

exports.createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      companyName,
      location,
      jobType,
      industry,
      salaryMin,
      salaryMax,
      currency,
      experienceLevel,
      minExperienceYears,
      minimumEducation,
      requiredSkills,
      preferredSkills,
      responsibilities,
      qualifications,
      benefits,
      applicationDeadline,
      status
    } = req.body;

    const job = await Job.create({
      employerId: req.user.id,
      title,
      description,
      companyName: companyName || null,
      location: location || null,
      jobType: jobType || 'full-time',
      industry: industry || null,
      salaryMin: salaryMin || null,
      salaryMax: salaryMax || null,
      currency: currency || 'INR',
      experienceLevel: experienceLevel || 'junior',
      minExperienceYears:
        minExperienceYears !== undefined && minExperienceYears !== null
          ? Number(minExperienceYears)
          : 0,
      minimumEducation: minimumEducation || null,
      requiredSkills: toArray(requiredSkills),
      preferredSkills: toArray(preferredSkills),
      responsibilities: toArray(responsibilities),
      qualifications: toArray(qualifications),
      benefits: toArray(benefits),
      applicationDeadline: applicationDeadline || null,
      status: status || 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job
    });
  } catch (error) {
    console.error('createJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.getAllJobs = async (req, res) => {
  try {
    const {
      keyword,
      location,
      jobType,
      industry,
      experienceLevel,
      status,
      minSalary,
      page = 1,
      limit = 10
    } = req.query;

    const where = {
      status: status || 'active'
    };

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { companyName: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (location) {
      where.location = {
        [Op.like]: `%${location}%`
      };
    }

    if (jobType) {
      where.jobType = jobType;
    }

    if (industry) {
      where.industry = {
        [Op.like]: `%${industry}%`
      };
    }

    if (experienceLevel) {
      where.experienceLevel = experienceLevel;
    }

    if (minSalary) {
      where.salaryMax = {
        [Op.gte]: Number(minSalary)
      };
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await Job.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'employer',
          attributes: ['id', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset
    });

    return res.json({
      success: true,
      count,
      currentPage: Number(page),
      totalPages: Math.ceil(count / Number(limit)),
      data: rows
    });
  } catch (error) {
    console.error('getAllJobs error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByPk(id, {
      include: [
        {
          model: User,
          as: 'employer',
          attributes: ['id', 'email']
        }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    return res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('getJobById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.findAll({
      where: {
        employerId: req.user.id
      },
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    console.error('getMyJobs error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByPk(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (req.user.role === 'employer' && job.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    const {
      title,
      description,
      companyName,
      location,
      jobType,
      industry,
      salaryMin,
      salaryMax,
      currency,
      experienceLevel,
      minExperienceYears,
      minimumEducation,
      requiredSkills,
      preferredSkills,
      responsibilities,
      qualifications,
      benefits,
      applicationDeadline,
      status
    } = req.body;

    await job.update({
      title: title ?? job.title,
      description: description ?? job.description,
      companyName: companyName ?? job.companyName,
      location: location ?? job.location,
      jobType: jobType ?? job.jobType,
      industry: industry ?? job.industry,
      salaryMin: salaryMin ?? job.salaryMin,
      salaryMax: salaryMax ?? job.salaryMax,
      currency: currency ?? job.currency,
      experienceLevel: experienceLevel ?? job.experienceLevel,
      minExperienceYears:
        minExperienceYears !== undefined && minExperienceYears !== null
          ? Number(minExperienceYears)
          : job.minExperienceYears,
      minimumEducation: minimumEducation ?? job.minimumEducation,
      requiredSkills:
        requiredSkills !== undefined ? toArray(requiredSkills) : job.requiredSkills,
      preferredSkills:
        preferredSkills !== undefined ? toArray(preferredSkills) : job.preferredSkills,
      responsibilities:
        responsibilities !== undefined ? toArray(responsibilities) : job.responsibilities,
      qualifications:
        qualifications !== undefined ? toArray(qualifications) : job.qualifications,
      benefits:
        benefits !== undefined ? toArray(benefits) : job.benefits,
      applicationDeadline: applicationDeadline ?? job.applicationDeadline,
      status: status ?? job.status
    });

    return res.json({
      success: true,
      message: 'Job updated successfully',
      data: job
    });
  } catch (error) {
    console.error('updateJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByPk(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (req.user.role === 'employer' && job.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job'
      });
    }

    await job.destroy();

    return res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('deleteJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.closeJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByPk(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (req.user.role === 'employer' && job.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to close this job'
      });
    }

    await job.update({
      status: 'closed'
    });

    return res.json({
      success: true,
      message: 'Job closed successfully',
      data: job
    });
  } catch (error) {
    console.error('closeJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.reopenJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByPk(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (req.user.role === 'employer' && job.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reopen this job'
      });
    }

    await job.update({
      status: 'active'
    });

    return res.json({
      success: true,
      message: 'Job reopened successfully',
      data: job
    });
  } catch (error) {
    console.error('reopenJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};