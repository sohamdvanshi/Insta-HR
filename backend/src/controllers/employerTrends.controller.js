const { Job, Application } = require('../models');

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const avg = (numbers) => {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const total = numbers.reduce((sum, n) => sum + toSafeNumber(n), 0);
  return Number((total / numbers.length).toFixed(2));
};

const monthKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const diffInDays = (fromDate, toDate) => {
  const start = new Date(fromDate);
  const end = new Date(toDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const ms = end.getTime() - start.getTime();
  const days = ms / (1000 * 60 * 60 * 24);

  if (!Number.isFinite(days) || days < 0) return null;
  return Number(days.toFixed(2));
};

const buildSortedMonthArray = (mapObject) => {
  return Object.entries(mapObject)
    .map(([month, count]) => ({
      month,
      count: toSafeNumber(count),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

exports.getEmployerHiringTrends = async (req, res) => {
  try {
    const employerId = req.user.id;

    const jobs = await Job.findAll({
      where: { employerId },
      attributes: ['id', 'title', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    const jobIds = jobs.map((job) => job.id);

    if (jobIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          summary: {
            applications: 0,
            interviews: 0,
            hired: 0,
            avgDaysToInterview: 0,
            avgDaysToHire: 0,
          },
          monthlyApplications: [],
          monthlyHires: [],
          slowJobs: [],
        },
      });
    }

    const applications = await Application.findAll({
      where: { jobId: jobIds },
      attributes: [
        'id',
        'jobId',
        'status',
        'createdAt',
        'updatedAt',
        'interviewDate',
      ],
      order: [['createdAt', 'ASC']],
    });

    const monthlyApplicationsMap = {};
    const monthlyHiresMap = {};
    const daysToInterviewList = [];
    const daysToHireList = [];

    const jobMetricsMap = {};

    jobs.forEach((job) => {
      jobMetricsMap[job.id] = {
        jobId: job.id,
        jobTitle: job.title || 'Untitled Job',
        applications: 0,
        hired: 0,
        avgDaysToHire: 0,
        hireDaysList: [],
      };
    });

    applications.forEach((app) => {
      const createdMonth = monthKey(app.createdAt);
      if (createdMonth) {
        monthlyApplicationsMap[createdMonth] =
          (monthlyApplicationsMap[createdMonth] || 0) + 1;
      }

      if (jobMetricsMap[app.jobId]) {
        jobMetricsMap[app.jobId].applications += 1;
      }

      if (app.interviewDate) {
        const daysToInterview = diffInDays(app.createdAt, app.interviewDate);
        if (daysToInterview !== null) {
          daysToInterviewList.push(daysToInterview);
        }
      }

      if (app.status === 'hired') {
        const hiredMonth = monthKey(app.updatedAt);
        if (hiredMonth) {
          monthlyHiresMap[hiredMonth] = (monthlyHiresMap[hiredMonth] || 0) + 1;
        }

        const daysToHire = diffInDays(app.createdAt, app.updatedAt);
        if (daysToHire !== null) {
          daysToHireList.push(daysToHire);

          if (jobMetricsMap[app.jobId]) {
            jobMetricsMap[app.jobId].hired += 1;
            jobMetricsMap[app.jobId].hireDaysList.push(daysToHire);
          }
        } else if (jobMetricsMap[app.jobId]) {
          jobMetricsMap[app.jobId].hired += 1;
        }
      }
    });

    const slowJobs = Object.values(jobMetricsMap)
      .map((job) => ({
        jobId: job.jobId,
        jobTitle: job.jobTitle,
        applications: toSafeNumber(job.applications),
        hired: toSafeNumber(job.hired),
        avgDaysToHire: avg(job.hireDaysList),
      }))
      .filter((job) => job.hired > 0)
      .sort((a, b) => b.avgDaysToHire - a.avgDaysToHire)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          applications: toSafeNumber(applications.length),
          interviews: toSafeNumber(
            applications.filter((app) => app.status === 'interview').length
          ),
          hired: toSafeNumber(
            applications.filter((app) => app.status === 'hired').length
          ),
          avgDaysToInterview: avg(daysToInterviewList),
          avgDaysToHire: avg(daysToHireList),
        },
        monthlyApplications: buildSortedMonthArray(monthlyApplicationsMap),
        monthlyHires: buildSortedMonthArray(monthlyHiresMap),
        slowJobs,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employer hiring trends.',
    });
  }
};