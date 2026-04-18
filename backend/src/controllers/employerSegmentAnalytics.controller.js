const { Job, Application } = require('../models');

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const percentage = (part, total) => {
  const safeTotal = toSafeNumber(total);
  if (safeTotal <= 0) return 0;
  return Number(((toSafeNumber(part) / safeTotal) * 100).toFixed(2));
};

const normalizeLabel = (value, fallback = 'Unknown') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
};

const buildSegmentRows = (mapObject) => {
  return Object.values(mapObject)
    .map((item) => ({
      label: item.label,
      applications: toSafeNumber(item.applications),
      hired: toSafeNumber(item.hired),
      hireRate: percentage(item.hired, item.applications),
    }))
    .sort((a, b) => {
      if (b.applications !== a.applications) return b.applications - a.applications;
      return b.hired - a.hired;
    });
};

exports.getEmployerSegmentPerformance = async (req, res) => {
  try {
    const employerId = req.user.id;

    const jobs = await Job.findAll({
      where: { employerId },
      attributes: ['id', 'jobType', 'industry', 'experienceLevel'],
    });

    const jobIds = jobs.map((job) => job.id);

    if (jobIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totals: {
            jobs: 0,
            applications: 0,
            hired: 0,
          },
          byJobType: [],
          byIndustry: [],
          byExperienceLevel: [],
        },
      });
    }

    const applications = await Application.findAll({
      where: { jobId: jobIds },
      attributes: ['jobId', 'status'],
    });

    const jobTypeMap = {};
    const industryMap = {};
    const experienceLevelMap = {};

    const jobLookup = {};

    jobs.forEach((job) => {
      jobLookup[job.id] = {
        jobType: normalizeLabel(job.jobType, 'Unknown'),
        industry: normalizeLabel(job.industry, 'Unknown'),
        experienceLevel: normalizeLabel(job.experienceLevel, 'Unknown'),
      };
    });

    applications.forEach((application) => {
      const jobMeta = jobLookup[application.jobId];
      if (!jobMeta) return;

      const jobType = jobMeta.jobType;
      const industry = jobMeta.industry;
      const experienceLevel = jobMeta.experienceLevel;
      const isHired = application.status === 'hired';

      if (!jobTypeMap[jobType]) {
        jobTypeMap[jobType] = {
          label: jobType,
          applications: 0,
          hired: 0,
        };
      }

      if (!industryMap[industry]) {
        industryMap[industry] = {
          label: industry,
          applications: 0,
          hired: 0,
        };
      }

      if (!experienceLevelMap[experienceLevel]) {
        experienceLevelMap[experienceLevel] = {
          label: experienceLevel,
          applications: 0,
          hired: 0,
        };
      }

      jobTypeMap[jobType].applications += 1;
      industryMap[industry].applications += 1;
      experienceLevelMap[experienceLevel].applications += 1;

      if (isHired) {
        jobTypeMap[jobType].hired += 1;
        industryMap[industry].hired += 1;
        experienceLevelMap[experienceLevel].hired += 1;
      }
    });

    const totalApplications = applications.length;
    const totalHired = applications.filter((app) => app.status === 'hired').length;

    return res.status(200).json({
      success: true,
      data: {
        totals: {
          jobs: toSafeNumber(jobs.length),
          applications: toSafeNumber(totalApplications),
          hired: toSafeNumber(totalHired),
        },
        byJobType: buildSegmentRows(jobTypeMap),
        byIndustry: buildSegmentRows(industryMap),
        byExperienceLevel: buildSegmentRows(experienceLevelMap),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employer segment analytics.',
    });
  }
};