const {
  User,
  Job,
  Application,
  Deployment,
  Payroll,
  Invoice,
  Payment,
  Training,
  CourseEnrollment,
} = require('../models');

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const safeArray = (value) => {
  return Array.isArray(value) ? value.filter(Boolean) : [];
};

const buildCountArray = (mapObject, labelKey) => {
  return Object.entries(mapObject || {}).map(([key, value]) => ({
    [labelKey]: key || 'Unknown',
    count: toSafeNumber(value),
  }));
};

const getAdminAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalJobs = await Job.count();
    const totalApplications = await Application.count();

    const shortlistedCandidates = await Application.count({
      where: { status: 'shortlisted' },
    });

    const hiredCandidates = await Application.count({
      where: { status: 'hired' },
    });

    const activeDeployments = await Deployment.count({
      where: { status: 'active' },
    });

    const payrollRecords = safeArray(
      await Payroll.findAll({
        attributes: ['netSalary'],
      })
    );

    const invoiceRecords = safeArray(
      await Invoice.findAll({
        attributes: ['totalAmount'],
      })
    );

    const paymentRecords = safeArray(
      await Payment.findAll({
        attributes: ['amount', 'status'],
      })
    );

    const totalPayrollAmount = payrollRecords.reduce(
      (sum, row) => sum + toSafeNumber(row?.netSalary),
      0
    );

    const totalInvoiceAmount = invoiceRecords.reduce(
      (sum, row) => sum + toSafeNumber(row?.totalAmount),
      0
    );

    const totalRevenue = paymentRecords
      .filter((row) => ['captured', 'paid', 'success'].includes(row?.status))
      .reduce((sum, row) => sum + toSafeNumber(row?.amount), 0);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: toSafeNumber(totalUsers),
        totalJobs: toSafeNumber(totalJobs),
        totalApplications: toSafeNumber(totalApplications),
        shortlistedCandidates: toSafeNumber(shortlistedCandidates),
        hiredCandidates: toSafeNumber(hiredCandidates),
        activeDeployments: toSafeNumber(activeDeployments),
        totalPayrollAmount,
        totalInvoiceAmount,
        totalRevenue,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch analytics summary.',
    });
  }
};

const getApplicationsTrend = async (req, res) => {
  try {
    const applications = safeArray(
      await Application.findAll({
        attributes: ['createdAt'],
        order: [['createdAt', 'ASC']],
      })
    );

    const monthlyMap = {};

    applications.forEach((item) => {
      if (!item?.createdAt) return;

      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: buildCountArray(monthlyMap, 'month').sort((a, b) =>
        a.month.localeCompare(b.month)
      ),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch applications trend.',
    });
  }
};

const getJobsByIndustry = async (req, res) => {
  try {
    const jobs = safeArray(
      await Job.findAll({
        attributes: ['industry'],
      })
    );

    const industryMap = {};

    jobs.forEach((job) => {
      const industry = job?.industry || 'Unknown';
      industryMap[industry] = (industryMap[industry] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: buildCountArray(industryMap, 'industry').sort(
        (a, b) => b.count - a.count
      ),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch jobs by industry.',
    });
  }
};

const getHiringFunnel = async (req, res) => {
  try {
    const applied = await Application.count();
    const shortlisted = await Application.count({
      where: { status: 'shortlisted' },
    });
    const interview = await Application.count({
      where: { status: 'interview' },
    });
    const hired = await Application.count({
      where: { status: 'hired' },
    });

    return res.status(200).json({
      success: true,
      data: [
        { stage: 'Applied', count: toSafeNumber(applied) },
        { stage: 'Shortlisted', count: toSafeNumber(shortlisted) },
        { stage: 'Interview', count: toSafeNumber(interview) },
        { stage: 'Hired', count: toSafeNumber(hired) },
      ],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch hiring funnel.',
    });
  }
};

const getPayrollStatusSummary = async (req, res) => {
  try {
    const payrolls = safeArray(
      await Payroll.findAll({
        attributes: ['status', 'netSalary'],
      })
    );

    const statusMap = {};

    payrolls.forEach((item) => {
      const status = item?.status || 'unknown';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });

    const statuses = buildCountArray(statusMap, 'status').sort(
      (a, b) => b.count - a.count
    );

    const totalNetSalary = payrolls.reduce(
      (sum, item) => sum + toSafeNumber(item?.netSalary),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        statuses,
        totalNetSalary,
        totalPayrolls: toSafeNumber(payrolls.length),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payroll status summary.',
    });
  }
};

const getInvoiceStatusSummary = async (req, res) => {
  try {
    const invoices = safeArray(
      await Invoice.findAll({
        attributes: ['status', 'totalAmount'],
      })
    );

    const statusMap = {};

    invoices.forEach((item) => {
      const status = item?.status || 'unknown';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });

    const statuses = buildCountArray(statusMap, 'status').sort(
      (a, b) => b.count - a.count
    );

    const totalInvoiceAmount = invoices.reduce(
      (sum, item) => sum + toSafeNumber(item?.totalAmount),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        statuses,
        totalInvoiceAmount,
        totalInvoices: toSafeNumber(invoices.length),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch invoice status summary.',
    });
  }
};

const getTrainingAnalytics = async (req, res) => {
  try {
    const totalCourses = await Training.count();
    const totalEnrollments = await CourseEnrollment.count();

    const completedEnrollments = await CourseEnrollment.count({
      where: { status: 'completed' },
    });

    const inProgressEnrollments = await CourseEnrollment.count({
      where: { status: 'active' },
    });

    const completionRate =
      toSafeNumber(totalEnrollments) > 0
        ? Number(
            (
              (toSafeNumber(completedEnrollments) /
                toSafeNumber(totalEnrollments)) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalCourses: toSafeNumber(totalCourses),
        totalEnrollments: toSafeNumber(totalEnrollments),
        completedEnrollments: toSafeNumber(completedEnrollments),
        inProgressEnrollments: toSafeNumber(inProgressEnrollments),
        completionRate,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch training analytics.',
    });
  }
};

const getTopEmployers = async (req, res) => {
  try {
    const jobs = safeArray(
      await Job.findAll({
        attributes: ['employerId'],
        include: [
          {
            model: User,
            as: 'employer',
            attributes: ['id', 'email'],
            required: false,
          },
        ],
      })
    );

    const employerMap = {};

    jobs.forEach((job, index) => {
      const employerId = job?.employerId || `unknown-${index}`;
      const employerName = job?.employer?.email || `Employer ${index + 1}`;

      if (!employerMap[employerId]) {
        employerMap[employerId] = {
          employerId,
          employerName,
          jobsPosted: 0,
        };
      }

      employerMap[employerId].jobsPosted += 1;
    });

    const data = Object.values(employerMap)
      .map((item) => ({
        employerId: item.employerId,
        employerName: item.employerName,
        jobsPosted: toSafeNumber(item.jobsPosted),
      }))
      .sort((a, b) => b.jobsPosted - a.jobsPosted)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch top employers.',
    });
  }
};

const getTopJobsByApplications = async (req, res) => {
  try {
    const applications = safeArray(
      await Application.findAll({
        attributes: ['jobId'],
        include: [
          {
            model: Job,
            as: 'job',
            attributes: ['id', 'title'],
            required: false,
          },
        ],
      })
    );

    const jobMap = {};

    applications.forEach((item, index) => {
      const jobId = item?.jobId || `unknown-${index}`;
      const jobTitle = item?.job?.title || 'Unknown Job';

      if (!jobMap[jobId]) {
        jobMap[jobId] = {
          jobId,
          jobTitle,
          applications: 0,
        };
      }

      jobMap[jobId].applications += 1;
    });

    const data = Object.values(jobMap)
      .map((item) => ({
        jobId: item.jobId,
        jobTitle: item.jobTitle,
        applications: toSafeNumber(item.applications),
      }))
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch top jobs by applications.',
    });
  }
};

module.exports = {
  getAdminAnalytics,
  getApplicationsTrend,
  getJobsByIndustry,
  getHiringFunnel,
  getPayrollStatusSummary,
  getInvoiceStatusSummary,
  getTrainingAnalytics,
  getTopEmployers,
  getTopJobsByApplications,
};