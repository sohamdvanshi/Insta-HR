const { Op } = require('sequelize');
const { Job, User } = require('../models');
const { clearCacheByPattern } = require('../middleware/cache');
const {
  indexJobDocument,
  deleteJobDocument
} = require('../services/search/jobSearch.service');

const FEATURED_ALLOWED_PLANS = ['premium', 'enterprise'];
const FEATURED_DURATION_DAYS = 30;

const normalizePlan = plan => String(plan || '').trim().toLowerCase();

const hasActiveSubscription = user => {
  if (!user?.subscriptionExpiry) return false;
  return new Date(user.subscriptionExpiry) > new Date();
};

const isFeatureAllowed = user => {
  if (!user) return false;

  const normalizedPlan = normalizePlan(user.subscriptionPlan);
  const allowedPlan = FEATURED_ALLOWED_PLANS.includes(normalizedPlan);
  const activeSubscription = hasActiveSubscription(user);

  return allowedPlan && activeSubscription;
};

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

const getFeaturedUntilDate = () => {
  return new Date(Date.now() + FEATURED_DURATION_DAYS * 24 * 60 * 60 * 1000);
};

const isJobFeaturedActive = job => {
  return Boolean(
    job.isFeatured &&
      job.featuredUntil &&
      new Date(job.featuredUntil) > new Date()
  );
};

const formatJob = job => {
  const plainJob = job.toJSON ? job.toJSON() : job;
  return {
    ...plainJob,
    activeFeatured: isJobFeaturedActive(plainJob)
  };
};

const invalidateJobRelatedCaches = async (jobId = null, employerId = null) => {
  try {
    await Promise.all([
      clearCacheByPattern('instahr:jobs-*'),
      clearCacheByPattern('instahr:admin-analytics-*'),
      clearCacheByPattern('instahr:employer-analytics-*'),
      clearCacheByPattern('instahr:applications-*'),
      jobId ? clearCacheByPattern(`instahr:job-${jobId}-*`) : Promise.resolve(),
      employerId ? clearCacheByPattern(`instahr:employer-${employerId}-*`) : Promise.resolve(),
    ]);
  } catch (error) {
    console.error('Job cache invalidation error:', error.message);
  }
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
      status,
      isFeatured
    } = req.body;

    const employer = await User.findByPk(req.user.id);

    if (!employer) {
      return res.status(404).json({
        success: false,
        message: 'Employer not found'
      });
    }

    let featuredValue = false;
    let featuredUntil = null;

    if (isFeatured) {
      if (!isFeatureAllowed(employer)) {
        return res.status(403).json({
          success: false,
          message: 'Only employers with an active Premium or Enterprise plan can feature jobs.'
        });
      }

      featuredValue = true;
      featuredUntil = getFeaturedUntilDate();
    }

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
      status: status || 'active',
      isFeatured: featuredValue,
      featuredUntil
    });

    await invalidateJobRelatedCaches(job.id, job.employerId);
    await indexJobDocument(job);

    return res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: formatJob(job)
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

    const formattedRows = rows.map(formatJob);

    formattedRows.sort((a, b) => {
      if (a.activeFeatured === b.activeFeatured) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return a.activeFeatured ? -1 : 1;
    });

    return res.json({
      success: true,
      count,
      currentPage: Number(page),
      totalPages: Math.ceil(count / Number(limit)),
      data: formattedRows
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
      data: formatJob(job)
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

    const formattedJobs = jobs.map(formatJob);

    return res.json({
      success: true,
      count: formattedJobs.length,
      data: formattedJobs
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

    const employer = await User.findByPk(req.user.id);

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
      status,
      isFeatured
    } = req.body;

    const updatePayload = {
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
    };

    if (isFeatured !== undefined) {
      if (isFeatured) {
        if (!isFeatureAllowed(employer)) {
          return res.status(403).json({
            success: false,
            message: 'Only employers with an active Premium or Enterprise plan can feature jobs.'
          });
        }

        updatePayload.isFeatured = true;
        updatePayload.featuredUntil = getFeaturedUntilDate();
      } else {
        updatePayload.isFeatured = false;
        updatePayload.featuredUntil = null;
      }
    }

    await job.update(updatePayload);

    await invalidateJobRelatedCaches(job.id, job.employerId);
    await indexJobDocument(job);

    // FIX #10: Reload job from DB so response contains the latest persisted values
    await job.reload();

    return res.json({
      success: true,
      message: 'Job updated successfully',
      data: formatJob(job)
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

    const deletedJobSnapshot = {
      jobId: job.id,
      employerId: job.employerId
    };

    await job.destroy();

    await invalidateJobRelatedCaches(
      deletedJobSnapshot.jobId,
      deletedJobSnapshot.employerId
    );
    await deleteJobDocument(deletedJobSnapshot.jobId);

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

    await job.update({ status: 'closed' });
    await job.reload();

    await invalidateJobRelatedCaches(job.id, job.employerId);
    await indexJobDocument(job);

    return res.json({
      success: true,
      message: 'Job closed successfully',
      data: formatJob(job)
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

    await job.update({ status: 'active' });
    await job.reload();

    await invalidateJobRelatedCaches(job.id, job.employerId);
    await indexJobDocument(job);

    return res.json({
      success: true,
      message: 'Job reopened successfully',
      data: formatJob(job)
    });
  } catch (error) {
    console.error('reopenJob error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const { searchJobsAdvanced } = require('../services/search/jobSearch.service');

exports.searchJobs = async (req, res) => {
  try {
    const result = await searchJobsAdvanced(req.query);

    return res.json({
      success: true,
      count: result.total,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      data: result.data
    });
  } catch (error) {
    console.error('searchJobs error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
