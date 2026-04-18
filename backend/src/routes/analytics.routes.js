const express = require('express');
const router = express.Router();
const { cacheResponse } = require('../middleware/cache');

const {
  getAdminAnalytics,
  getApplicationsTrend,
  getJobsByIndustry,
  getHiringFunnel,
  getPayrollStatusSummary,
  getInvoiceStatusSummary,
  getTrainingAnalytics,
  getTopEmployers,
  getTopJobsByApplications,
} = require('../controllers/analytics.controller');

router.get(
  '/summary',
  cacheResponse({ prefix: 'admin-analytics-summary', ttl: 120 }),
  getAdminAnalytics
);

router.get(
  '/applications-trend',
  cacheResponse({ prefix: 'admin-analytics-applications-trend', ttl: 300 }),
  getApplicationsTrend
);

router.get(
  '/jobs-by-industry',
  cacheResponse({ prefix: 'admin-analytics-jobs-industry', ttl: 300 }),
  getJobsByIndustry
);

router.get(
  '/hiring-funnel',
  cacheResponse({ prefix: 'admin-analytics-hiring-funnel', ttl: 180 }),
  getHiringFunnel
);

router.get(
  '/payroll-status',
  cacheResponse({ prefix: 'admin-analytics-payroll-status', ttl: 180 }),
  getPayrollStatusSummary
);

router.get(
  '/invoice-status',
  cacheResponse({ prefix: 'admin-analytics-invoice-status', ttl: 180 }),
  getInvoiceStatusSummary
);

router.get(
  '/training',
  cacheResponse({ prefix: 'admin-analytics-training', ttl: 300 }),
  getTrainingAnalytics
);

router.get(
  '/top-employers',
  cacheResponse({ prefix: 'admin-analytics-top-employers', ttl: 300 }),
  getTopEmployers
);

router.get(
  '/top-jobs',
  cacheResponse({ prefix: 'admin-analytics-top-jobs', ttl: 300 }),
  getTopJobsByApplications
);

module.exports = router;