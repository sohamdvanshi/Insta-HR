const { Op } = require('sequelize');
const { AuditLog, FraudAlert, User, Application } = require('../models');
const { writeAuditLog } = require('../utils/auditLogger');

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

exports.getAuditLogs = async (req, res) => {
  try {
    const {
      actorId,
      action,
      entityType,
      entityId,
      targetUserId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {};

    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (targetUserId) where.targetUserId = targetUserId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate);
      }
    }

    const safePage = Math.max(toSafeNumber(page), 1);
    const safeLimit = Math.min(Math.max(toSafeNumber(limit), 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: safeLimit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(count / safeLimit),
      },
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch audit logs',
    });
  }
};

exports.getFraudAlerts = async (req, res) => {
  try {
    const {
      candidateId,
      applicationId,
      ruleCode,
      severity,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {};

    if (candidateId) where.candidateId = candidateId;
    if (applicationId) where.applicationId = applicationId;
    if (ruleCode) where.ruleCode = ruleCode;
    if (severity) where.severity = severity;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate);
      }
    }

    const safePage = Math.max(toSafeNumber(page), 1);
    const safeLimit = Math.min(Math.max(toSafeNumber(limit), 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const { count, rows } = await FraudAlert.findAndCountAll({
      where,
      include: [
        {
          model: Application,
          as: 'application',
          required: false,
          attributes: ['id', 'jobId', 'candidateId', 'status', 'manualReviewStatus', 'aiScore'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: safeLimit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(count / safeLimit),
      },
    });
  } catch (error) {
    console.error('getFraudAlerts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch fraud alerts',
    });
  }
};

exports.getFraudAlertsSummary = async (req, res) => {
  try {
    const [
      totalAlerts,
      openAlerts,
      reviewedAlerts,
      dismissedAlerts,
      confirmedAlerts,
      highSeverityAlerts,
      mediumSeverityAlerts,
      lowSeverityAlerts,
    ] = await Promise.all([
      FraudAlert.count(),
      FraudAlert.count({ where: { status: 'open' } }),
      FraudAlert.count({ where: { status: 'reviewed' } }),
      FraudAlert.count({ where: { status: 'dismissed' } }),
      FraudAlert.count({ where: { status: 'confirmed' } }),
      FraudAlert.count({ where: { severity: 'high' } }),
      FraudAlert.count({ where: { severity: 'medium' } }),
      FraudAlert.count({ where: { severity: 'low' } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalAlerts,
        byStatus: {
          open: openAlerts,
          reviewed: reviewedAlerts,
          dismissed: dismissedAlerts,
          confirmed: confirmedAlerts,
        },
        bySeverity: {
          high: highSeverityAlerts,
          medium: mediumSeverityAlerts,
          low: lowSeverityAlerts,
        },
      },
    });
  } catch (error) {
    console.error('getFraudAlertsSummary error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch fraud alerts summary',
    });
  }
};

exports.updateFraudAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['reviewed', 'dismissed', 'confirmed'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fraud alert status',
      });
    }

    const fraudAlert = await FraudAlert.findByPk(id);

    if (!fraudAlert) {
      return res.status(404).json({
        success: false,
        message: 'Fraud alert not found',
      });
    }

    const previousStatus = fraudAlert.status;

    await fraudAlert.update({
      status,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
    });

    await writeAuditLog({
      req,
      action: 'FRAUD_ALERT_STATUS_UPDATED',
      entityType: 'FraudAlert',
      entityId: fraudAlert.id,
      targetUserId: fraudAlert.candidateId,
      metadata: {
        applicationId: fraudAlert.applicationId,
        ruleCode: fraudAlert.ruleCode,
        severity: fraudAlert.severity,
        previousStatus,
        nextStatus: fraudAlert.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Fraud alert status updated successfully',
      data: fraudAlert,
    });
  } catch (error) {
    console.error('updateFraudAlertStatus error:', error);

    await writeAuditLog({
      req,
      action: 'FRAUD_ALERT_STATUS_UPDATE_FAILED',
      entityType: 'FraudAlert',
      entityId: req.params?.id || null,
      targetUserId: null,
      status: 'failure',
      metadata: {
        attemptedStatus: req.body?.status || null,
        error: error.message || 'Internal server error',
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update fraud alert status',
    });
  }
};

exports.getAuditDashboardSummary = async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      recentAuditLogs,
      failedAuditEvents,
      applicationCreateFailures,
      fraudOpenAlerts,
      fraudConfirmedAlerts,
      recentHighSeverityAlerts,
    ] = await Promise.all([
      AuditLog.count({
        where: {
          createdAt: {
            [Op.gte]: since,
          },
        },
      }),
      AuditLog.count({
        where: {
          status: 'failure',
          createdAt: {
            [Op.gte]: since,
          },
        },
      }),
      AuditLog.count({
        where: {
          action: 'APPLICATION_CREATE_FAILED',
          createdAt: {
            [Op.gte]: since,
          },
        },
      }),
      FraudAlert.count({
        where: { status: 'open' },
      }),
      FraudAlert.count({
        where: { status: 'confirmed' },
      }),
      FraudAlert.count({
        where: {
          severity: 'high',
          createdAt: {
            [Op.gte]: since,
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        window: 'last_7_days',
        audit: {
          totalEvents: recentAuditLogs,
          failedEvents: failedAuditEvents,
          applicationCreateFailures,
        },
        fraud: {
          openAlerts: fraudOpenAlerts,
          confirmedAlerts: fraudConfirmedAlerts,
          highSeverityRecent: recentHighSeverityAlerts,
        },
      },
    });
  } catch (error) {
    console.error('getAuditDashboardSummary error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch audit dashboard summary',
    });
  }
};