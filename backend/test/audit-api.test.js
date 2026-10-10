// Real routers/controllers; isolated ORM and provider doubles. No live data is modified.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { randomUUID } = require('node:crypto');
process.env.JWT_SECRET = 'audit-isolated-test';
const models = {}, users = new Map();
let writes = [], jobs, profile, deployment, attendanceQuery, redisKeys, cleared = [], failAuth = false, aiCalls = 0, flagEnabled = true, createFails = false, otpFails = false, welcomeFails = false, transactionLog = [];
const user = role => ({ id: randomUUID(), role, email: `${role}@example.com`, isActive: true, isEmailVerified: true });
const employer = user('employer'), otherEmployer = user('employer'), admin = user('admin'), superAdmin = user('super_admin'), candidate = user('candidate');
for (const row of [employer, otherEmployer, admin, superAdmin, candidate]) users.set(row.id, row);
const instance = data => ({ ...data, toJSON() { return { ...data }; }, async update(changes) { writes.push(changes); Object.assign(this, changes); return this; }, async save() { writes.push({ ...this }); }, async destroy() { writes.push({ deleted: this.id }); } });
for (const name of ['Job', 'Application', 'CandidateProfile', 'EmployerProfile', 'Payroll', 'Attendance', 'Deployment', 'Invoice', 'Contract', 'FeatureFlag', 'AuditLog', 'Referral', 'FraudAlert', 'LoyaltyPointTransaction']) models[name] = {
  findAll: async () => [], findOne: async () => null, findByPk: async () => null,
  findAndCountAll: async () => ({ rows: [], count: 0 }), count: async () => 0,
  create: async data => { writes.push({ model: name, ...data }); return instance({ id: randomUUID(), ...data }); }, update: async () => [0]
};
models.User = {
  findByPk: async id => { if (failAuth) throw new Error('database unavailable'); return users.get(id) || null; },
  findOne: async () => null,
  create: async (data, options) => { transactionLog.push(['user', options?.transaction]); return instance({ id: randomUUID(), ...data }); }
};
models.sequelize = { transaction: async callback => { const tx = { LOCK: { UPDATE: 'UPDATE' } }; try { const result = await callback(tx); transactionLog.push(['commit']); return result; } catch (error) { transactionLog.push(['rollback']); throw error; } } };
function mock(file, exports) { const p = require.resolve(file); require.cache[p] = { id: p, filename: p, loaded: true, exports }; }
mock('../src/models', models); mock('../src/models/index', models);
const redis = { isOpen: true, async *scanIterator() { for (const item of redisKeys || []) yield item; }, del: async key => cleared.push(key), get: async () => null, set: async () => {} };
mock('../src/config/redis', { getRedisClient: () => redis });
const elastic = { indices: {}, index: async () => { throw new Error('search down'); }, delete: async () => { throw new Error('search down'); }, search: async () => { throw new Error('search down'); } };
mock('../src/config/elasticsearch', { elasticClient: elastic });
mock('../src/services/email/emailService', {
  sendOTPEmail: async () => { if (otpFails) throw new Error('mail down'); }, sendWelcomeEmail: async () => { if (welcomeFails) throw new Error('mail down'); },
  sendInterviewScheduledEmail: async () => {}, sendApplicationStatusEmail: async () => {}
});
mock('../src/services/ai/resumeParserService', { extractResumeText: async () => 'Python engineer' });
mock('../src/services/ai/resumeScreeningService', { screenResumeAgainstJob: async () => { aiCalls++; return { aiScore: 90, aiStatus: 'shortlisted' }; } });
mock('../src/utils/auditLogger', { writeAuditLog: async () => {} });
mock('../src/utils/fraudDetector', { runApplicationFraudChecks: async () => ({}) });
mock('../src/services/referralReward.service', { awardReferralReward: async () => ({}), DEFAULT_REFERRAL_REWARD_POINTS: 10 });
const analytics = require('../src/controllers/analytics.controller');
for (const key of Object.keys(analytics)) analytics[key] = (req, res) => res.json({ success: true, role: req.user?.role });
const app = express(); app.use(express.json());
app.use('/api/v1/admin/analytics', require('../src/routes/analytics.routes'));
app.use('/api/v1/admin/audit', require('../src/routes/adminAudit.routes'));
app.use('/api/v1/candidates', require('../src/routes/candidate.routes'));
app.use('/api/v1/employers', require('../src/routes/employer.routes'));
app.use('/api/v1/employer/payrolls', require('../src/routes/payroll.routes'));
app.use('/api/v1/employer/invoices', require('../src/routes/invoice.routes'));
app.use('/api/v1/employer/attendance', require('../src/routes/attendance.routes'));
app.use('/api/v1/jobs', require('../src/routes/job.routes'));
app.use('/api/v1/auth', require('../src/routes/auth.routes'));
const applications = require('../src/controllers/application.controller');
app.post('/test/apply/:jobId', require('../src/middleware/auth').protect, (req, res, next) => { req.file = { path: '/nonexistent/audit-resume.pdf', filename: 'audit.pdf', originalname: 'audit.pdf' }; next(); }, applications.applyToJob);
let server, origin;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  writes = []; cleared = []; failAuth = false; aiCalls = 0; flagEnabled = true; createFails = false; otpFails = false; welcomeFails = false; transactionLog = [];
  jobs = instance({ id: randomUUID(), employerId: employer.id, status: 'active', title: 'Python developer', requiredSkills: ['Python'], description: 'Python engineer' });
  profile = instance({ id: randomUUID(), userId: candidate.id, firstName: 'Open', lastName: 'General', isVerified: false });
  deployment = instance({ id: randomUUID(), employerId: employer.id, candidateId: candidate.id });
  models.Job.findByPk = async () => jobs;
  models.CandidateProfile.findOne = async () => profile;
  models.EmployerProfile.findOne = async () => profile;
  models.CandidateProfile.findAll = async () => [profile];
  models.Deployment.findOne = async () => deployment;
  models.Attendance.findAll = async query => { attendanceQuery = query; return [{ status: 'present' }, { status: 'late' }, { status: 'half_day' }]; };
  models.FeatureFlag.findByPk = async () => ({ enabled: flagEnabled });
  models.Application.findOne = async () => null;
  models.Application.findByPk = async () => instance({ id: randomUUID(), aiStatus: 'pending' });
  models.User.findOne = async () => null;
  models.CandidateProfile.create = async (data, options) => { transactionLog.push(['profile', options?.transaction]); if (createFails) throw new Error('profile invalid'); writes.push(data); return instance(data); };
});
async function request(url, actor, body, method) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (actor) headers.Authorization = `Bearer ${jwt.sign({ id: actor.id }, process.env.JWT_SECRET)}`;
  const response = await fetch(origin + url, { method: method || (body ? 'POST' : 'GET'), headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
test('analytics rejects anonymous and nonstaff requests before the controller/cache', async () => {
  assert.equal((await request('/api/v1/admin/analytics/summary')).status, 401);
  assert.equal((await request('/api/v1/admin/analytics/summary', candidate)).status, 403);
  assert.equal((await request('/api/v1/admin/analytics/summary', employer)).status, 403);
  for (const actor of [admin, superAdmin]) assert.equal((await request('/api/v1/admin/analytics/summary', actor)).status, 200);
});
test('super admin can reach the existing audit/fraud endpoints', async () => { assert.equal((await request('/api/v1/admin/audit/summary', superAdmin)).status, 200); });
test('temporary database auth failure returns 503 while invalid tokens still return 401', async () => {
  failAuth = true; assert.equal((await request('/api/v1/candidates/profile', candidate)).status, 503);
  const response = await fetch(origin + '/api/v1/candidates/profile', { headers: { Authorization: 'Bearer garbage' } }); assert.equal(response.status, 401);
});
test('candidate profile update keeps identity and server-controlled upload metadata', async () => {
  const result = await request('/api/v1/candidates/profile', candidate, { firstName: 'Changed', userId: employer.id, id: employer.id, photoPublicId: 'foreign/photo', resumePublicId: 'foreign/resume', profileCompleteness: 100 }, 'PUT');
  assert.equal(result.status, 200); assert.deepEqual(writes, [{ firstName: 'Changed' }]); assert.equal(profile.userId, candidate.id);
});
test('employer cannot self-verify or transfer ownership through profile editing', async () => {
  const result = await request('/api/v1/employers/profile', employer, { companyName: 'General', isVerified: true, userId: candidate.id, totalJobsPosted: 999, logoPublicId: 'foreign/logo' }, 'PUT');
  assert.equal(result.status, 200); assert.deepEqual(writes, [{ companyName: 'General' }]); assert.equal(profile.isVerified, false);
});
test('AI matching checks job ownership before sending candidate data to the provider', async () => {
  let calls = 0; const savedFetch = global.fetch;
  // Handler-level provider spy; the request itself uses the captured real fetch.
  global.fetch = async (...args) => { if (String(args[0]).includes('/match-candidates')) { calls++; return { ok: true, json: async () => ({ success: true, data: [{ candidateId: candidate.id }] }) }; } return savedFetch(...args); };
  try {
    assert.equal((await request('/api/v1/candidates/ai-match/' + jobs.id, otherEmployer)).status, 403); assert.equal(calls, 0);
    const result = await request('/api/v1/candidates/ai-match/' + jobs.id, employer); assert.equal(result.status, 200); assert.ok(Array.isArray(result.body.data)); assert.equal(result.body.data[0].candidateId, candidate.id);
    assert.equal((await request('/api/v1/candidates/ai-match/' + jobs.id, superAdmin)).status, 200);
  } finally { global.fetch = savedFetch; }
});
test('disabled AI flag blocks direct matching without making an external request', async () => { flagEnabled = false; assert.equal((await request('/api/v1/candidates/ai-match/' + jobs.id, employer)).status, 503); });
test('closed/draft jobs and expired deadlines reject applications before PDF parsing', async () => {
  for (const status of ['closed', 'draft']) { jobs.status = status; assert.equal((await request('/test/apply/' + jobs.id, candidate, {})).status, 400); }
  jobs.status = 'active'; jobs.applicationDeadline = '2020-01-01'; assert.equal((await request('/test/apply/' + jobs.id, candidate, {})).status, 400); assert.equal(writes.length, 0);
});
test('application is saved for manual review without automatic AI when feature is disabled', async () => {
  flagEnabled = false; const result = await request('/test/apply/' + jobs.id, candidate, {}); assert.equal(result.status, 201); assert.equal(aiCalls, 0); assert.ok(writes.some(row => row.model === 'Application'));
});
test('draft job detail is private but remains accessible to its owner and staff', async () => {
  jobs.status = 'draft'; const url = '/api/v1/jobs/' + jobs.id;
  assert.equal((await request(url)).status, 404); assert.equal((await request(url, otherEmployer)).status, 404);
  assert.equal((await request(url, employer)).status, 200); assert.equal((await request(url, superAdmin)).status, 200);
});
test('public job list cannot expose drafts by passing a status query', async () => {
  let where; models.Job.findAndCountAll = async query => { where = query.where; return { rows: [], count: 0 }; };
  await request('/api/v1/jobs?status=draft'); assert.equal(where.status, 'active');
});
test('payroll date boundaries are exact and independent of an India timezone server', async () => {
  const old = process.env.TZ; process.env.TZ = 'Asia/Kolkata';
  try {
    const result = await request('/api/v1/employer/payrolls', employer, { deploymentId: deployment.id, payPeriodMonth: '2024-02', grossSalary: 1000, deductions: 10.2, bonus: 0.3 });
    assert.equal(result.status, 201); assert.deepEqual(attendanceQuery.where.attendanceDate[Op.between], ['2024-02-01', '2024-02-29']); assert.equal(result.body.data.totalPresentDays, 2); assert.equal(result.body.data.netSalary, 990.1);
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
test('invalid payroll months and money are rejected instead of inserted or returning 500', async () => {
  for (const payPeriodMonth of ['2024-00', '2024-13', 'garbage']) assert.equal((await request('/api/v1/employer/payrolls', employer, { deploymentId: deployment.id, payPeriodMonth, grossSalary: 100 })).status, 400);
  for (const grossSalary of [-1, '', 'Infinity', 'abc', 1.234]) assert.equal((await request('/api/v1/employer/payrolls', employer, { deploymentId: deployment.id, payPeriodMonth: '2024-07', grossSalary })).status, 400);
  assert.equal(writes.length, 0);
});
test('invalid invoice dates, reversed due date and negative/non-numeric amounts are rejected', async () => {
  const valid = { deploymentId: deployment.id, billingPeriodMonth: '2024-07', invoiceDate: '2024-07-01', dueDate: '2024-07-31', subtotal: 100, taxAmount: 18 };
  for (const patch of [{ dueDate: '2024-06-30' }, { invoiceDate: '2024-02-30' }, { subtotal: -1 }, { taxAmount: 'abc' }]) assert.equal((await request('/api/v1/employer/invoices', employer, { ...valid, ...patch })).status, 400);
  const result = await request('/api/v1/employer/invoices', employer, { ...valid, subtotal: 0.1, taxAmount: 0.2 }); assert.equal(result.status, 201); assert.equal(result.body.data.totalAmount, 0.3);
});
test('attendance rejects impossible dates and checkout before check-in', async () => {
  const valid = { deploymentId: deployment.id, attendanceDate: '2024-07-01', status: 'present' };
  assert.equal((await request('/api/v1/employer/attendance', employer, { ...valid, attendanceDate: '2024-02-30' })).status, 400);
  assert.equal((await request('/api/v1/employer/attendance', employer, { ...valid, checkInTime: '2024-07-01T10:00:00Z', checkOutTime: '2024-07-01T09:00:00Z' })).status, 400);
});
test('registration rejects missing candidate names without creating an orphan user', async () => {
  const result = await request('/api/v1/auth/register', null, { email: 'new@example.com', password: 'strongpassword' }); assert.equal(result.status, 400); assert.equal(transactionLog.length, 0);
});
test('registration rolls back user/profile together if profile creation fails', async () => {
  createFails = true; const result = await request('/api/v1/auth/register', null, { email: 'new@example.com', password: 'strongpassword', firstName: 'New' });
  assert.equal(result.status, 500); assert.equal(transactionLog.at(-1)[0], 'rollback'); assert.equal(transactionLog[0][1], transactionLog[1][1]); assert.ok(transactionLog[0][1]);
});
test('OTP mail outage returns a recoverable pending account; welcome mail outage does not consume login', async () => {
  otpFails = true; const result = await request('/api/v1/auth/register', null, { email: 'new@example.com', password: 'strongpassword', firstName: 'New' }); assert.equal(result.status, 201); assert.equal(result.body.otpSent, false); assert.ok(result.body.userId);
  const pending = instance({ ...candidate, otp: '123456', otpExpiry: new Date(Date.now() + 60000), referralCode: 'INSTAABC' }); users.set(candidate.id, pending); welcomeFails = true;
  const verified = await request('/api/v1/auth/verify-otp', null, { userId: candidate.id, otp: '123456' }); assert.equal(verified.status, 200); assert.ok(verified.body.token); users.set(candidate.id, candidate);
});
test('Redis invalidation clears batched and legacy scan results', async () => {
  redisKeys = [['one', 'two'], [], 'three', Buffer.from('four')]; const count = await require('../src/middleware/cache').clearCacheByPattern('*'); assert.equal(count, 4); assert.deepEqual(cleared.map(String), ['one', 'two', 'three', 'four']);
});
test('search outage does not fail committed index/delete operations; advanced search falls back to SQL', async () => {
  const service = require('../src/services/search/jobSearch.service'); await service.indexJobDocument(jobs); await service.deleteJobDocument(jobs.id);
  let options; models.Job.findAndCountAll = async query => { options = query; return { rows: [jobs], count: 1 }; };
  const result = await service.searchJobsAdvanced({ keyword: 'Python', status: 'draft', page: 1.7, limit: 10.8, sortBy: 'salaryHigh' });
  assert.equal(result.total, 1); assert.equal(result.currentPage, 1); assert.equal(options.limit, 10); assert.equal(options.where.status, 'active'); assert.equal(options.order[0][0], 'salaryMax');
});
