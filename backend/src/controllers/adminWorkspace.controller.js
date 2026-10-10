const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const M = require('../models');
const { User, Job, Application, Payment, Invoice, CandidateProfile, EmployerProfile, Resume, CourseEnrollment, Training, Deployment, Payroll, LoyaltyPointTransaction, AuditLog, InternalThread, SubscriptionPlan, FeatureFlag, sequelize } = M;
const { ROLES, FLAGS, USER_FIELDS, fail, id, reason, text, pagination, safeUser, parsePlan } = require('../services/adminPolicy');
const { handle, audit, changeUserAccess } = require('../services/adminOperations');
const userInclude = (as, required = false) => ({ model: User, as, attributes: ['id', 'email', 'role'], required });
const pageResult = async (model, req, res, options = {}) => {
  const p = pagination(req.query);
  const result = await model.findAndCountAll({ order: [['createdAt', 'DESC'], ['id', 'ASC']], ...options, ...p, distinct: true });
  res.json({ success: true, data: result.rows, pagination: { page: p.page, limit: p.limit, total: result.count, pages: Math.ceil(result.count / p.limit) } });
};
const search = value => {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > 200) fail('Search must be less than 200 characters');
  return `%${value.trim().replace(/[\\%_]/g, '\\$&')}%`;
};
exports.me = handle(async (req, res) => res.json({ success: true, data: safeUser(req.user) }));
exports.staff = handle(async (req, res) => pageResult(User, req, res, { where: { role: ['admin', 'super_admin', 'trainer'] }, attributes: USER_FIELDS }));
exports.summary = handle(async (req, res) => {
  const [candidates, employers, jobs, applications, revenue, openTickets] = await Promise.all([
    User.count({ where: { role: 'candidate' } }), User.count({ where: { role: 'employer' } }), Job.count(), Application.count(),
    Payment.sum('amount', { where: { status: 'success' } }), InternalThread.count({ where: { status: ['open', 'in_progress'] } })
  ]);
  res.json({ success: true, data: { candidates, employers, jobs, applications, revenue: Number(revenue || 0), openTickets } });
});
exports.users = handle(async (req, res) => {
  const where = {}, q = search(req.query.q);
  if (req.query.role) { if (!ROLES.includes(req.query.role)) fail('Invalid role filter'); where.role = req.query.role; }
  if (req.query.active !== undefined) { if (!['true', 'false'].includes(req.query.active)) fail('Invalid account status'); where.isActive = req.query.active === 'true'; }
  if (q) where[Op.or] = [{ email: { [Op.iLike]: q } }, { phone: { [Op.iLike]: q } }, { '$candidateProfile.firstName$': { [Op.iLike]: q } }, { '$candidateProfile.lastName$': { [Op.iLike]: q } }, { '$employerProfile.companyName$': { [Op.iLike]: q } }];
  await pageResult(User, req, res, { where, subQuery: false, attributes: USER_FIELDS, include: [{ model: CandidateProfile, as: 'candidateProfile', attributes: ['firstName', 'lastName', 'currentLocation', 'industry'], required: false }, { model: EmployerProfile, as: 'employerProfile', attributes: ['companyName', 'city', 'isVerified'], required: false }] });
});
exports.user = handle(async (req, res) => {
  const user = await User.findByPk(id(req.params.id), { attributes: USER_FIELDS });
  if (!user) fail('User not found', 404);
  const profile = user.role === 'candidate' ? await CandidateProfile.findOne({ where: { userId: user.id } }) : user.role === 'employer' ? await EmployerProfile.findOne({ where: { userId: user.id } }) : null;
  const balance = user.role === 'candidate' ? Number(await LoyaltyPointTransaction.sum('points', { where: { userId: user.id } }) || 0) : null;
  res.json({ success: true, data: { user: safeUser(user), profile, loyaltyBalance: balance } });
});
exports.activity = handle(async (req, res) => {
  const user = await User.findByPk(id(req.params.id), { attributes: ['id', 'role'] });
  if (!user) fail('User not found', 404);
  const candidate = user.role === 'candidate', employer = user.role === 'employer';
  const type = req.query.type;
  if (type === 'payments') return pageResult(Payment, req, res, { where: { userId: user.id } });
  if (type === 'jobs' && employer) return pageResult(Job, req, res, { where: { employerId: user.id } });
  if (type === 'resumes' && candidate) return pageResult(Resume, req, res, { where: { userId: user.id } });
  if (type === 'loyalty' && candidate) return pageResult(LoyaltyPointTransaction, req, res, { where: { userId: user.id } });
  if (type === 'training' && candidate) return pageResult(CourseEnrollment, req, res, { where: { userId: user.id }, include: [{ model: Training, as: 'training', attributes: ['id', 'title'] }] });
  if (type === 'applications' && (candidate || employer)) return pageResult(Application, req, res, {
    where: candidate ? { candidateId: user.id } : {}, attributes: { exclude: ['aiRawResponse'] },
    include: [{ model: Job, as: 'job', attributes: ['id', 'title', 'companyName', 'employerId'], ...(employer ? { where: { employerId: user.id }, required: true } : {}) }, userInclude('candidate')]
  });
  if (type === 'deployments' && (candidate || employer)) return pageResult(Deployment, req, res, { where: candidate ? { candidateId: user.id } : { employerId: user.id } });
  if (type === 'payrolls' && (candidate || employer)) return pageResult(Payroll, req, res, { where: candidate ? { candidateId: user.id } : { employerId: user.id } });
  if (type === 'invoices' && (candidate || employer)) return pageResult(Invoice, req, res, { where: candidate ? { candidateId: user.id } : { employerId: user.id } });
  if (type === 'attendance' && (candidate || employer)) return pageResult(M.Attendance, req, res, { where: candidate ? { candidateId: user.id } : { employerId: user.id } });
  if (type === 'classes' && candidate) return pageResult(M.TrainingAttendance, req, res, { where: { userId: user.id }, include: [{ model: M.TrainingSession, as: 'session', attributes: ['id', 'title', 'startsAt', 'mode'] }] });
  if (type === 'manpower' && employer) return pageResult(M.ManpowerRequest, req, res, { where: { employerId: user.id } });
  if (type === 'campaigns' && employer) return pageResult(M.BulkEmailCampaign, req, res, { where: { employerId: user.id } });
  if (type === 'contracts' && employer) return pageResult(M.Contract, req, res, { where: { employerId: user.id } });
  fail('This activity is not available for this user');
});
exports.jobs = handle(async (req, res) => {
  const where = {}, q = search(req.query.q);
  if (req.query.status) { if (!['draft', 'active', 'closed'].includes(req.query.status)) fail('Invalid job status'); where.status = req.query.status; }
  if (req.query.employerId) where.employerId = id(req.query.employerId);
  if (q) where[Op.or] = [{ title: { [Op.iLike]: q } }, { companyName: { [Op.iLike]: q } }];
  await pageResult(Job, req, res, { where, include: [userInclude('employer')] });
});
exports.applications = handle(async (req, res) => {
  const where = {};
  if (req.query.status) { if (!Application.APPLICATION_STATUSES.includes(req.query.status)) fail('Invalid application status'); where.status = req.query.status; }
  if (req.query.candidateId) where.candidateId = id(req.query.candidateId);
  if (req.query.jobId) where.jobId = id(req.query.jobId);
  await pageResult(Application, req, res, { where, attributes: { exclude: ['aiRawResponse'] }, include: [{ model: Job, as: 'job', attributes: ['id', 'title', 'companyName', 'employerId'] }, userInclude('candidate')] });
});
exports.payments = handle(async (req, res) => {
  const where = {};
  if (req.query.status) { if (!['created', 'success', 'failed'].includes(req.query.status)) fail('Invalid payment status'); where.status = req.query.status; }
  if (req.query.userId) where.userId = id(req.query.userId);
  await pageResult(Payment, req, res, { where, include: [userInclude('user')] });
});
exports.invoices = handle(async (req, res) => {
  const where = {};
  if (req.query.status) { if (!['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(req.query.status)) fail('Invalid invoice status'); where.status = req.query.status; }
  await pageResult(Invoice, req, res, { where, include: [userInclude('employer'), userInclude('candidate')] });
});
exports.auditLogs = handle(async (req, res) => {
  const where = {};
  for (const field of ['actorId', 'entityId', 'targetUserId']) if (req.query[field]) where[field] = id(req.query[field]);
  for (const field of ['action', 'entityType']) if (req.query[field]) where[field] = text(req.query[field], field, 100);
  await pageResult(AuditLog, req, res, { where });
});
exports.changeRole = handle(async (req, res) => res.json({ success: true, data: await changeUserAccess(req, 'role') }));
exports.changeAccess = handle(async (req, res) => res.json({ success: true, data: await changeUserAccess(req, 'access') }));
exports.jobStatus = handle(async (req, res) => {
  if (!['draft', 'active', 'closed'].includes(req.body.status)) fail('Invalid job status');
  const why = reason(req.body.reason);
  const data = await sequelize.transaction(async transaction => {
    const job = await Job.findByPk(id(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
    if (!job) fail('Job not found', 404);
    const before = job.status; await job.update({ status: req.body.status }, { transaction });
    await audit(req, transaction, 'admin.job_status', 'job', job.id, { reason: why, before, after: job.status });
    return job;
  });
  const { clearCacheByPattern } = require('../middleware/cache');
  await Promise.all(['instahr:jobs-*', 'instahr:job-detail:*', 'instahr:admin-analytics-*', `instahr:employer-${data.employerId}-*`].map(clearCacheByPattern));
  // Keep Elasticsearch consistent with the SQL moderation decision when available.
  try { const { elasticClient } = require('../config/elasticsearch'); const { JOBS_INDEX } = require('../services/search/jobSearch.service'); await elasticClient.update({ index: JOBS_INDEX, id: data.id, doc: { status: data.status }, refresh: true }, { requestTimeout: 2000, maxRetries: 0 }); } catch { /* SQL remains authoritative; reindex:jobs repairs the search mirror. */ }
  res.json({ success: true, data });
});
exports.adjust = handle(async (req, res) => {
  const why = reason(req.body.reason), targetId = id(req.params.id);
  const data = await sequelize.transaction(async transaction => {
    const target = await User.findByPk(targetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!target) fail('User not found', 404);
    if (!['candidate', 'employer'].includes(target.role)) fail('Adjustments are limited to candidate and employer accounts');
    if (req.body.kind === 'loyalty') {
      if (target.role !== 'candidate') fail('Only candidate accounts have loyalty points');
      const points = req.body.points;
      if (!Number.isSafeInteger(points) || !points || Math.abs(points) > 1000) fail('Point adjustments must be an integer from -1000 to 1000, excluding zero');
      const before = Number(await LoyaltyPointTransaction.sum('points', { where: { userId: target.id }, transaction }) || 0);
      if (before + points < 0) fail('The loyalty balance cannot become negative');
      await LoyaltyPointTransaction.create({ userId: target.id, points, type: 'adjusted', reason: why, createdBy: req.user.id }, { transaction });
      await audit(req, transaction, 'admin.loyalty_adjustment', 'user', target.id, { reason: why, points, before, after: before + points });
      return { loyaltyBalance: before + points };
    }
    if (req.body.kind === 'employer_verification') {
      if (target.role !== 'employer' || typeof req.body.isVerified !== 'boolean') fail('Provide an employer verification status');
      const profile = await EmployerProfile.findOne({ where: { userId: target.id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!profile) fail('Employer profile not found', 404);
      const before = profile.isVerified; await profile.update({ isVerified: req.body.isVerified }, { transaction });
      await audit(req, transaction, 'admin.employer_verification', 'user', target.id, { reason: why, before, after: profile.isVerified });
      return { isVerified: profile.isVerified };
    }
    if (req.body.kind === 'subscription') {
      if (req.user.role !== 'super_admin') fail('Only super admin can adjust subscriptions', 403);
      if (target.role !== 'employer') fail('Subscriptions are for employers');
      const plan = await SubscriptionPlan.findByPk(req.body.plan);
      if (!plan || !plan.isActive) fail('Choose an active plan');
      const days = req.body.days;
      if (!Number.isSafeInteger(days) || days < 1 || days > 365) fail('Access duration must be 1–365 days');
      const before = { plan: target.subscriptionPlan, expiry: target.subscriptionExpiry };
      const expiry = plan.id === 'free' ? null : new Date(Date.now() + days * 86400000);
      await target.update({ subscriptionPlan: plan.id, subscriptionExpiry: expiry, subscriptionReminder7Sent: false, subscriptionReminder1Sent: false, subscriptionExpiredMailSent: false }, { transaction });
      await audit(req, transaction, 'admin.subscription_adjustment', 'user', target.id, { reason: why, before, after: { plan: plan.id, expiry } });
      return { plan: plan.id, expiry };
    }
    fail('Unknown adjustment');
  });
  res.json({ success: true, data });
});
exports.createStaff = handle(async (req, res) => {
  const why = reason(req.body.reason), email = User.normalizeEmail(req.body.email), password = req.body.password;
  if (!['admin', 'super_admin'].includes(req.body.role)) fail('Choose admin or super admin');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 128) fail('Provide a valid email and a password with 12–128 characters');
  const hash = await bcrypt.hash(password, 12);
  const data = await sequelize.transaction(async transaction => {
    if (await User.findOne({ where: { email }, transaction })) fail('An account already exists for this email', 409);
    const user = await User.create({ email, password: hash, role: req.body.role, isActive: true, isEmailVerified: true, authProvider: 'local' }, { transaction });
    await audit(req, transaction, 'admin.staff_created', 'user', user.id, { reason: why, role: user.role });
    return safeUser(user);
  });
  res.status(201).json({ success: true, data });
});
exports.plans = handle(async (req, res) => res.json({ success: true, data: await SubscriptionPlan.findAll({ order: [['amountPaise', 'ASC']] }) }));
exports.updatePlan = handle(async (req, res) => {
  if (!['free', 'standard', 'premium', 'enterprise'].includes(req.params.id)) fail('Unknown plan');
  const why = reason(req.body.reason), changes = parsePlan(req.body, req.params.id);
  const data = await sequelize.transaction(async transaction => {
    const plan = await SubscriptionPlan.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!plan) fail('Plan not found', 404);
    const before = plan.toJSON(); await plan.update(changes, { transaction });
    await audit(req, transaction, 'admin.plan_updated', 'subscription_plan', null, { reason: why, planId: plan.id, before, after: plan.toJSON() });
    return plan;
  });
  res.json({ success: true, data });
});
exports.flags = handle(async (req, res) => res.json({ success: true, data: (await FeatureFlag.findAll({ order: [['key', 'ASC']] })).map(flag => ({ ...flag.toJSON(), description: FLAGS[flag.key] })) }));
exports.updateFlag = handle(async (req, res) => {
  if (!FLAGS[req.params.key] || typeof req.body.enabled !== 'boolean') fail('Invalid feature flag');
  const why = reason(req.body.reason);
  const data = await sequelize.transaction(async transaction => {
    const flag = await FeatureFlag.findByPk(req.params.key, { transaction, lock: transaction.LOCK.UPDATE });
    if (!flag) fail('Feature flag not found', 404);
    const before = flag.enabled; await flag.update({ enabled: req.body.enabled }, { transaction });
    await audit(req, transaction, 'admin.feature_flag', 'feature_flag', null, { reason: why, key: flag.key, before, after: flag.enabled });
    return flag;
  });
  res.json({ success: true, data });
});
exports.infrastructure = handle(async (req, res) => {
  let database = 'unavailable', searchStatus = 'unavailable';
  try { await sequelize.query('SELECT 1', { benchmark: true }); database = 'connected'; } catch { /* Report availability without database credentials. */ }
  try { await require('../config/elasticsearch').elasticClient.ping({}, { requestTimeout: 2000, maxRetries: 0 }); searchStatus = 'connected'; } catch { /* Search is an optional integration. */ }
  const redis = require('../config/redis').getRedisClient();
  res.json({ success: true, data: { checkedAt: new Date(), uptimeSeconds: Math.floor(process.uptime()), nodeVersion: process.version, memoryMB: Math.round(process.memoryUsage().rss / 1048576), database, redis: redis?.isReady ? 'connected' : 'unavailable', search: searchStatus,
    integrations: { smtp: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS), payments: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) } } });
});
exports.publicPlans = handle(async (req, res) => res.json({ success: true, data: await SubscriptionPlan.findAll({ where: { isActive: true }, order: [['amountPaise', 'ASC']] }) }));
