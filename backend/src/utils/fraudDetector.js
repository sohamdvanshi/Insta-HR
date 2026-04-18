const { Op } = require('sequelize');
const { Application, FraudAlert } = require('../models');

const createAlertIfNotExists = async ({
  candidateId,
  applicationId,
  ruleCode,
  severity,
  riskScore,
  reason,
  metadata = {},
}) => {
  const existing = await FraudAlert.findOne({
    where: {
      candidateId,
      applicationId,
      ruleCode,
      status: {
        [Op.in]: ['open', 'reviewed', 'confirmed'],
      },
    },
  });

  if (existing) {
    return null;
  }

  return FraudAlert.create({
    candidateId,
    applicationId,
    ruleCode,
    severity,
    riskScore,
    reason,
    status: 'open',
    metadata,
  });
};

const runApplicationFraudChecks = async (application) => {
  try {
    if (!application?.id || !application?.candidateId) {
      return {
        alertsCreated: 0,
        alerts: [],
      };
    }

    const alerts = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const applicationsLastHour = await Application.count({
      where: {
        candidateId: application.candidateId,
        createdAt: {
          [Op.gte]: oneHourAgo,
        },
      },
    });

    if (applicationsLastHour >= 5) {
      const alert = await createAlertIfNotExists({
        candidateId: application.candidateId,
        applicationId: application.id,
        ruleCode: 'HIGH_APPLICATION_BURST',
        severity: 'high',
        riskScore: 90,
        reason: 'Candidate submitted many applications within one hour.',
        metadata: {
          applicationsLastHour,
          window: '1_hour',
        },
      });

      if (alert) alerts.push(alert);
    }

    const applicationsLastDay = await Application.count({
      where: {
        candidateId: application.candidateId,
        createdAt: {
          [Op.gte]: oneDayAgo,
        },
      },
    });

    if (applicationsLastDay >= 15) {
      const alert = await createAlertIfNotExists({
        candidateId: application.candidateId,
        applicationId: application.id,
        ruleCode: 'UNUSUAL_DAILY_APPLICATION_VOLUME',
        severity: 'medium',
        riskScore: 70,
        reason: 'Candidate submitted an unusual number of applications in 24 hours.',
        metadata: {
          applicationsLastDay,
          window: '24_hours',
        },
      });

      if (alert) alerts.push(alert);
    }

    if (
      application.aiScore !== null &&
      application.aiScore !== undefined &&
      Number(application.aiScore) < 35
    ) {
      const alert = await createAlertIfNotExists({
        candidateId: application.candidateId,
        applicationId: application.id,
        ruleCode: 'VERY_LOW_AI_SCORE',
        severity: 'medium',
        riskScore: 60,
        reason: 'Application received a very low AI screening score.',
        metadata: {
          aiScore: application.aiScore,
          aiStatus: application.aiStatus || null,
        },
      });

      if (alert) alerts.push(alert);
    }

    if (
      application.aiStatus === 'rejected' &&
      application.manualReviewStatus === 'approved'
    ) {
      const alert = await createAlertIfNotExists({
        candidateId: application.candidateId,
        applicationId: application.id,
        ruleCode: 'AI_REJECTED_BUT_MANUALLY_APPROVED',
        severity: 'high',
        riskScore: 85,
        reason: 'Application was AI-rejected but later manually approved.',
        metadata: {
          aiScore: application.aiScore,
          aiStatus: application.aiStatus,
          manualReviewStatus: application.manualReviewStatus,
        },
      });

      if (alert) alerts.push(alert);
    }

    return {
      alertsCreated: alerts.length,
      alerts,
    };
  } catch (error) {
    console.error('runApplicationFraudChecks error:', error.message);
    return {
      alertsCreated: 0,
      alerts: [],
    };
  }
};

module.exports = {
  runApplicationFraudChecks,
};