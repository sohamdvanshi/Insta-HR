const { Op } = require('sequelize');
const { User, AuditLog, sequelize } = require('../models');
const { fail, id, reason, ROLES } = require('./adminPolicy');
const audit = (req, transaction, action, entityType, entityId, metadata = {}) => AuditLog.create({
  actorId: req.user.id, actorRole: req.user.role, action, entityType, entityId,
  targetUserId: entityType === 'user' ? entityId : null, status: 'success',
  ipAddress: req.ip || null, userAgent: req.headers?.['user-agent']?.slice(0, 1000) || null, metadata
}, { transaction });
const handle = fn => async (req, res) => {
  try { await fn(req, res); } catch (error) {
    if (!error.status) console.error('Admin operation:', error.message);
    const code = error.original?.code;
    const status = error.status || (code === '23505' ? 409 : code === '22P02' ? 400 : 500);
    const message = error.status ? error.message : code === '23505' ? 'This record already exists' : code === '22P02' ? 'Invalid record value' : code === '42P01' || code === '42703' ? 'Database setup is incomplete. Run migrate:phase6 on the backend.' : 'Unable to complete admin operation';
    res.status(status).json({ success: false, message });
  }
};
// Serialize role/activation changes across the staff set. Locks use a stable order,
// so concurrent requests cannot remove the last active super administrator.
const changeUserAccess = async (req, mode) => sequelize.transaction(async transaction => {
  const targetId = id(req.params.id), why = reason(req.body.reason);
  const staff = await User.findAll({ where: { role: { [Op.in]: ['admin', 'super_admin'] } }, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  const target = staff.find(user => user.id === targetId) || await User.findByPk(targetId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!target) fail('User not found', 404);
  if (req.user.role !== 'super_admin' && (mode === 'role' || !['candidate', 'employer', 'trainer'].includes(target.role))) fail('Only super admin can change staff access', 403);
  const before = { role: target.role, isActive: target.isActive };
  const data = mode === 'role' ? { role: req.body.role } : { isActive: req.body.isActive === undefined ? !target.isActive : req.body.isActive };
  if (mode === 'role' && !ROLES.includes(data.role)) fail('Invalid user role');
  if (mode !== 'role' && typeof data.isActive !== 'boolean') fail('Account status must be a boolean');
  const removesSuper = target.role === 'super_admin' && target.isActive && (data.role && data.role !== 'super_admin' || data.isActive === false);
  if (target.id === req.user.id && (data.role && data.role !== 'super_admin' || data.isActive === false)) fail('You cannot remove your own administrator access');
  if (removesSuper && staff.filter(user => user.role === 'super_admin' && user.isActive).length <= 1) fail('At least one active super admin must remain');
  await target.update(data, { transaction });
  await audit(req, transaction, mode === 'role' ? 'admin.user_role' : 'admin.user_access', 'user', target.id, { reason: why, before, after: { role: target.role, isActive: target.isActive } });
  return { id: target.id, email: target.email, role: target.role, isActive: target.isActive };
});
module.exports = { audit, handle, changeUserAccess };
