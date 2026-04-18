const { Job, Application } = require('../models');

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const percent = (numerator, denominator) => {
  const top = toSafeNumber(numerator);
  const bottom = toSafeNumber(denominator);

  if (bottom <= 0) return 0;
  return Number(((top / bottom) * 100).toFixed(2));
};

const getEmployerFunnelAnalytics = async (req, res) => {
  try {
    const employerId = req.user.id;

    const jobs = await Job.findAll({
      where: { employerId },
      attributes: ['id', 'title', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    const jobIds = jobs.map((job) => job.id);

    const jobsPosted = jobs.length;

    if (jobIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          jobsPosted: 0,
          applications: 0,
          shortlisted: 0,
          interview: 0,
          hired: 0,
          rejected: 0,
          conversionRates: {
            applicationToShortlisted: 0,
            shortlistedToInterview: 0,
            interviewToHired: 0,
            applicationToHired: 0,
          },
          topJobs: [],
        },
      });
    }

    const applications = await Application.findAll({
      where: { jobId: jobIds },
      attributes: ['id', 'jobId', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    const totalApplications = applications.length;
    const shortlisted = applications.filter((app) => app.status === 'shortlisted').length;
    const interview = applications.filter((app) => app.status === 'interview').length;
    const hired = applications.filter((app) => app.status === 'hired').length;
    const rejected = applications.filter((app) => app.status === 'rejected').length;

    const topJobsMap = {};

    jobs.forEach((job) => {
      topJobsMap[job.id] = {
        jobId: job.id,
        jobTitle: job.title || 'Untitled Job',
        applications: 0,
        shortlisted: 0,
        interview: 0,
        hired: 0,
        rejected: 0,
        applicationToHireRate: 0,
      };
    });

    applications.forEach((app) => {
      if (!topJobsMap[app.jobId]) return;

      topJobsMap[app.jobId].applications += 1;

      if (app.status === 'shortlisted') topJobsMap[app.jobId].shortlisted += 1;
      if (app.status === 'interview') topJobsMap[app.jobId].interview += 1;
      if (app.status === 'hired') topJobsMap[app.jobId].hired += 1;
      if (app.status === 'rejected') topJobsMap[app.jobId].rejected += 1;
    });

    const topJobs = Object.values(topJobsMap)
      .map((job) => ({
        ...job,
        applicationToHireRate: percent(job.hired, job.applications),
      }))
      .sort((a, b) => {
        if (b.hired !== a.hired) return b.hired - a.hired;
        return b.applications - a.applications;
      })
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data: {
        jobsPosted: toSafeNumber(jobsPosted),
        applications: toSafeNumber(totalApplications),
        shortlisted: toSafeNumber(shortlisted),
        interview: toSafeNumber(interview),
        hired: toSafeNumber(hired),
        rejected: toSafeNumber(rejected),
        conversionRates: {
          applicationToShortlisted: percent(shortlisted, totalApplications),
          shortlistedToInterview: percent(interview, shortlisted),
          interviewToHired: percent(hired, interview),
          applicationToHired: percent(hired, totalApplications),
        },
        topJobs,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employer funnel analytics.',
    });
  }
};

module.exports = {
  getEmployerFunnelAnalytics,
};