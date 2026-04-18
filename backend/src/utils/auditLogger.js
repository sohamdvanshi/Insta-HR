const { AuditLog } = require('../models');

const getClientIp = (req) => {
  if (!req) return null;

  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return (
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
};

const sanitizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return {};

  try {
    return JSON.parse(JSON.stringify(metadata));
  } catch (error) {
    return {
      note: 'Metadata serialization failed',
    };
  }
};

const writeAuditLog = async ({
  req = null,
  action,
  entityType,
  entityId = null,
  targetUserId = null,
  status = 'success',
  metadata = {},
}) => {
  try {
    if (!action || !entityType) return null;

    return await AuditLog.create({
      actorId: req?.user?.id || null,
      actorRole: req?.user?.role || 'system',
      action,
      entityType,
      entityId,
      targetUserId,
      status,
      ipAddress: getClientIp(req),
      userAgent: req?.headers?.['user-agent'] || null,
      metadata: sanitizeMetadata(metadata),
    });
  } catch (error) {
    console.error('writeAuditLog error:', error.message);
    return null;
  }
};

module.exports = {
  writeAuditLog,
};