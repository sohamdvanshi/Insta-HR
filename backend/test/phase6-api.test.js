// Exercise real Express routers/JWT authorization with isolated ORM/provider doubles.
// No live database, payment, email, Redis or search service is contacted.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { randomUUID } = crypto;
process.env.JWT_SECRET = 'phase6-isolated-test';
process.env.RAZORPAY_KEY_SECRET = 'phase6-provider-secret';
const rows = {}, models = {};
let auditFails = false, providerPayment, orderCounter = 0, queue = Promise.resolve();
const copy = value => JSON.parse(JSON.stringify(value));
function match(row, where = {}) {
  return Reflect.ownKeys(where).every(key => {
    if (key === Op.or) return where[key].some(condition => match(row, condition));
    const expected = where[key], value = row[key];
    if (Array.isArray(expected)) return expected.includes(value);
    if (expected && typeof expected === 'object') return Reflect.ownKeys(expected).every(operator => {
      if (operator === Op.in) return expected[operator].includes(value);
      if (operator === Op.iLike) return String(value || '').toLowerCase().includes(expected[operator].replace(/^%|%$/g, '').replace(/\\/g, '').toLowerCase());
      return value === expected[operator];
    });
    return value === expected;
  });
}
function define(name) {
  rows[name] = [];
  const key = name === 'FeatureFlag' ? 'key' : 'id';
  const defaults = { InternalThread: { status: 'open', priority: 'normal' }, FeatureFlag: { enabled: true }, Payment: { status: 'created' }, User: { isActive: true }, SubscriptionPlan: { currency: 'INR', isActive: true } };
  const instance = (row, attributes) => {
    const data = attributes && Array.isArray(attributes) ? Object.fromEntries(attributes.map(field => [field, row[field]])) : { ...row };
    if (attributes?.exclude) for (const field of attributes.exclude) delete data[field];
    Object.defineProperties(data, {
      toJSON: { value() { return { ...this }; } },
      update: { value: async function(changes) { Object.assign(row, changes, { updatedAt: new Date().toISOString() }); Object.assign(this, changes); return this; } },
      destroy: { value: async () => { rows[name] = rows[name].filter(item => item[key] !== row[key]); } }
    });
    return data;
  };
  const api = {
    create: async data => {
      if (name === 'AuditLog' && auditFails) throw new Error('Audit storage unavailable');
      const row = { id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...defaults[name], ...data };
      if (name === 'FeatureFlag') delete row.id;
      rows[name].push(row); return instance(row);
    },
    findByPk: async (id, options = {}) => (await api.findAll({ ...options, where: { [key]: id } }))[0] || null,
    findOne: async options => (await api.findAll(options))[0] || null,
    findAll: async (options = {}) => {
      let found = [];
      for (const row of rows[name].filter(row => match(row, options.where))) {
        const item = instance(row, options.attributes); let eligible = true;
        for (const include of options.include || []) {
          const foreignKeys = { creator: 'createdBy', assignee: 'assignedTo', sender: 'senderId', author: 'authorId', employer: 'employerId', candidate: 'candidateId', user: 'userId', job: 'jobId', training: 'trainingId' };
          const related = ['candidateProfile', 'employerProfile'].includes(include.as)
            ? await include.model.findOne({ where: { userId: row.id }, attributes: include.attributes })
            : await include.model.findOne({ where: { id: row[foreignKeys[include.as]], ...include.where }, attributes: include.attributes });
          if ((include.required || include.where) && !related) { eligible = false; break; }
          item[include.as] = related;
        }
        if (eligible) found.push(item);
      }
      if (options.order) found.sort((a, b) => {
        for (const [field, direction] of options.order) { const difference = String(a[field] || '').localeCompare(String(b[field] || '')); if (difference) return direction === 'DESC' ? -difference : difference; }
        return 0;
      });
      return found.slice(options.offset || 0, options.limit ? (options.offset || 0) + options.limit : undefined);
    },
    findAndCountAll: async options => ({ count: (await api.findAll({ ...options, offset: 0, limit: undefined })).length, rows: await api.findAll(options) }),
    count: async options => (await api.findAll(options)).length,
    sum: async (field, options) => (await api.findAll(options)).reduce((total, row) => total + Number(row[field] || 0), 0),
    update: async (changes, options) => { const found = await api.findAll(options); await Promise.all(found.map(row => row.update(changes))); return [found.length]; }
  };
  return api;
}
for (const name of ['User', 'Job', 'Application', 'Payment', 'Invoice', 'CandidateProfile', 'EmployerProfile', 'Resume', 'CourseEnrollment', 'Training', 'Deployment', 'Payroll', 'LoyaltyPointTransaction', 'AuditLog', 'InternalThread', 'InternalMessage', 'InternalNote', 'SubscriptionPlan', 'FeatureFlag', 'FraudAlert']) models[name] = define(name);
models.User.normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : null;
models.Application.APPLICATION_STATUSES = ['applied', 'shortlisted', 'interview', 'hired', 'rejected'];
models.sequelize = {
  query: async () => [[{ result: 1 }]],
  transaction: fn => {
    const run = async () => {
      const snapshot = copy(rows);
      try { return await fn({ LOCK: { UPDATE: 'UPDATE' } }); }
      catch (error) { for (const name of Object.keys(rows)) rows[name] = snapshot[name]; throw error; }
    };
    const result = queue.then(run); queue = result.catch(() => {}); return result;
  }
};
require.cache[require.resolve('../src/models/index')] = { exports: models };
require.cache[require.resolve('../src/config/elasticsearch')] = { exports: { elasticClient: { ping: async () => true, update: async () => {} } } };
require.cache[require.resolve('../src/services/search/jobSearch.service')] = { exports: { JOBS_INDEX: 'jobs' } };
require.cache[require.resolve('../src/config/redis')] = { exports: { getRedisClient: () => ({ isReady: true }) } };
require.cache[require.resolve('razorpay')] = { exports: class {
  constructor() { this.orders = { create: async options => ({ id: `order_${++orderCounter}`, ...options }) }; this.payments = { fetch: async () => providerPayment }; }
} };
const app = express(); app.use(express.json());
app.use('/api/v1/admin/workspace', require('../src/routes/adminWorkspace.routes'));
app.use('/api/v1/admin', require('../src/routes/admin.routes'));
app.use('/api/v1/internal', require('../src/routes/internalCommunication.routes'));
app.use('/api/v1/payments', require('../src/routes/payment.routes'));
app.get('/api/v1/test-feature', require('../src/services/featureControl').requireFeature('training'), (req, res) => res.json({ success: true }));
let server, base;
const ids = Object.fromEntries(['super', 'secondSuper', 'admin', 'secondAdmin', 'candidate', 'employer', 'otherEmployer', 'trainer', 'job', 'otherJob', 'application', 'profile', 'ticket'].map(key => [key, randomUUID()]));
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}/api/v1`; });
after(async () => new Promise(resolve => server.close(resolve)));
beforeEach(async () => {
  for (const key of Object.keys(rows)) rows[key] = [];
  auditFails = false; orderCounter = 0; providerPayment = null;
  for (const [name, role] of [['super', 'super_admin'], ['admin', 'admin'], ['secondAdmin', 'admin'], ['candidate', 'candidate'], ['employer', 'employer'], ['otherEmployer', 'employer'], ['trainer', 'trainer']]) await models.User.create({ id: ids[name], email: `${name}@example.com`, role, password: 'must-not-leak', otp: 'secret-otp', googleId: 'private-provider-id', isActive: true });
  await models.CandidateProfile.create({ userId: ids.candidate, firstName: 'Test', education: [{ degree: 'BTech' }], skills: ['React'] });
  await models.EmployerProfile.create({ id: ids.profile, userId: ids.employer, companyName: 'Sample Company', isVerified: false });
  await models.Job.create({ id: ids.job, employerId: ids.employer, title: 'Developer', status: 'active' });
  await models.Job.create({ id: ids.otherJob, employerId: ids.otherEmployer, title: 'Warehouse', status: 'draft' });
  await models.Application.create({ id: ids.application, candidateId: ids.candidate, jobId: ids.job, status: 'applied', aiRawResponse: 'internal payload' });
  await models.Application.create({ candidateId: ids.candidate, jobId: ids.otherJob, status: 'rejected' });
  await models.SubscriptionPlan.create({ id: 'standard', name: 'Standard', amountPaise: 199900, durationDays: 30, features: ['Resume search'], isActive: true });
  await models.FeatureFlag.create({ key: 'training', enabled: true });
  await models.LoyaltyPointTransaction.create({ userId: ids.candidate, points: 20, type: 'earned', reason: 'Referral' });
});
async function request(path, role = 'admin', method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers.Authorization = `Bearer ${jwt.sign({ id: ids[role], role: 'super_admin' }, process.env.JWT_SECRET)}`;
  const response = await fetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
const reason = 'Reviewed by the support team';
test('nonstaff are denied; internal admins cannot use super admin controls', async () => {
  for (const role of [null, 'candidate', 'employer', 'trainer']) assert.ok([401, 403].includes((await request('/admin/workspace/users', role)).status));
  for (const path of ['/admin/workspace/plans', '/admin/workspace/flags', '/admin/workspace/infrastructure', '/admin/workspace/staff']) assert.equal((await request(path)).status, 403);
  assert.equal((await request('/admin/workspace/plans', 'super')).status, 200);
  assert.equal((await request(`/admin/workspace/users/${ids.candidate}/role`, 'admin', 'PATCH', { role: 'admin', reason })).status, 403);
});
test('candidate profiles and user lists expose business data but no auth secrets', async () => {
  const list = await request('/admin/workspace/users?role=candidate&limit=1');
  assert.equal(list.status, 200); assert.equal(list.data.pagination.total, 1);
  for (const field of ['password', 'otp', 'googleId']) assert.equal(list.data.data[0][field], undefined);
  const detail = await request(`/admin/workspace/users/${ids.candidate}`);
  assert.equal(detail.data.data.profile.education[0].degree, 'BTech'); assert.equal(detail.data.data.loyaltyBalance, 20); assert.equal(detail.data.data.user.password, undefined);
  assert.equal((await request('/admin/workspace/users/not-an-id')).status, 400);
  assert.equal((await request('/admin/workspace/users?page=1.5')).status, 400);
});
test('employer application history is scoped to its jobs; filters and pages work', async () => {
  const result = await request(`/admin/workspace/users/${ids.employer}/activity?type=applications`);
  assert.equal(result.data.pagination.total, 1); assert.equal(result.data.data[0].job.id, ids.job); assert.equal(result.data.data[0].aiRawResponse, undefined);
  const jobs = await request('/admin/workspace/jobs?status=draft&limit=1'); assert.equal(jobs.data.data[0].id, ids.otherJob);
  assert.equal((await request('/admin/workspace/applications?status=unknown')).status, 400);
});
test('admin access changes require a reason and cannot deactivate staff, including legacy routes', async () => {
  assert.equal((await request(`/admin/workspace/users/${ids.candidate}/access`, 'admin', 'PATCH', { isActive: false })).status, 400);
  assert.equal((await request(`/admin/workspace/users/${ids.super}/access`, 'admin', 'PATCH', { isActive: false, reason })).status, 403);
  assert.equal((await request(`/admin/users/${ids.secondAdmin}/toggle`, 'admin', 'PUT', { reason })).status, 403);
  const result = await request(`/admin/workspace/users/${ids.candidate}/access`, 'admin', 'PATCH', { isActive: false, reason });
  assert.equal(result.status, 200); assert.equal(rows.AuditLog[0].metadata.before.isActive, true); assert.equal(rows.AuditLog[0].metadata.after.isActive, false);
});
test('role and activation protections retain a super admin; concurrent cross-deactivation retains one', async () => {
  assert.equal((await request(`/admin/workspace/users/${ids.super}/role`, 'super', 'PATCH', { role: 'admin', reason })).status, 400);
  await models.User.create({ id: ids.secondSuper, email: 'second@example.com', role: 'super_admin', isActive: true });
  const results = await Promise.all([
    request(`/admin/workspace/users/${ids.secondSuper}/access`, 'super', 'PATCH', { isActive: false, reason }),
    request(`/admin/workspace/users/${ids.super}/access`, 'secondSuper', 'PATCH', { isActive: false, reason })
  ]);
  assert.ok(results.some(result => result.status === 200));
  assert.equal(rows.User.filter(user => user.role === 'super_admin' && user.isActive).length, 1);
});
test('failed audit persistence rolls back a manual change', async () => {
  auditFails = true;
  assert.equal((await request(`/admin/workspace/users/${ids.candidate}/access`, 'admin', 'PATCH', { isActive: false, reason })).status, 500);
  assert.equal(rows.User.find(user => user.id === ids.candidate).isActive, true); assert.equal(rows.AuditLog.length, 0);
});
test('loyalty and verification adjustments are bounded; billing access requires super admin', async () => {
  const path = `/admin/workspace/users/${ids.candidate}/adjustments`;
  assert.equal((await request(path, 'admin', 'POST', { kind: 'loyalty', points: -21, reason })).status, 400);
  assert.equal((await request(path, 'admin', 'POST', { kind: 'loyalty', points: 1001, reason })).status, 400);
  assert.equal((await request(path, 'admin', 'POST', { kind: 'loyalty', points: 5, reason })).data.data.loyaltyBalance, 25);
  const employerPath = `/admin/workspace/users/${ids.employer}/adjustments`;
  assert.equal((await request(employerPath, 'admin', 'POST', { kind: 'employer_verification', isVerified: true, reason })).status, 200);
  assert.equal((await request(employerPath, 'admin', 'POST', { kind: 'subscription', plan: 'standard', days: 30, reason })).status, 403);
  assert.equal((await request(employerPath, 'super', 'POST', { kind: 'subscription', plan: 'standard', days: 30, reason })).status, 200);
  assert.equal(rows.Payment.length, 0); assert.equal(rows.AuditLog.length, 3);
});
test('staff provisioning hashes passwords and never includes them in responses or audit metadata', async () => {
  const result = await request('/admin/workspace/staff', 'super', 'POST', { email: 'newadmin@example.com', password: 'LongInitialPassword12', role: 'admin', reason });
  assert.equal(result.status, 201); assert.equal(result.data.data.password, undefined);
  const user = rows.User.find(user => user.email === 'newadmin@example.com'); assert.ok(await bcrypt.compare('LongInitialPassword12', user.password));
  assert.ok(!JSON.stringify(rows.AuditLog).includes('LongInitialPassword12'));
  assert.equal((await request('/admin/workspace/staff', 'admin', 'POST', { email: 'forbidden@example.com', password: 'LongInitialPassword12', role: 'super_admin', reason })).status, 403);
});
test('feature switches persist, block users, and allow genuine active staff management', async () => {
  const flag = await request('/admin/workspace/flags/training', 'super', 'PATCH', { enabled: false, reason }); assert.equal(flag.status, 200);
  assert.equal((await request('/test-feature', null)).status, 503);
  assert.equal((await request('/test-feature', 'candidate')).status, 503); // A forged role claim does not bypass the DB role.
  assert.equal((await request('/test-feature', 'admin')).status, 200);
  assert.equal((await request('/test-feature', 'super')).status, 200);
  await request('/admin/workspace/flags/training', 'super', 'PATCH', { enabled: true, reason });
  assert.equal((await request('/test-feature', null)).status, 200);
});
test('tickets validate linked records and assignees, paginate messages, and disallow replies until reopened', async () => {
  const body = { subject: 'Candidate support', body: 'Please review this case', category: 'support', relatedEntityType: 'candidate', relatedEntityId: ids.candidate, assignedTo: ids.secondAdmin };
  assert.equal((await request('/internal/threads', 'admin', 'POST', { ...body, relatedEntityId: ids.employer })).status, 404);
  assert.equal((await request('/internal/threads', 'admin', 'POST', { ...body, assignedTo: ids.candidate })).status, 400);
  const result = await request('/internal/threads', 'admin', 'POST', body); assert.equal(result.status, 201);
  const path = `/internal/threads/${result.data.data.id}`;
  assert.equal((await request(path + '/messages', 'admin')).data.pagination.total, 1);
  await request(path + '/status', 'admin', 'PUT', { status: 'closed' });
  assert.equal((await request(path + '/messages', 'secondAdmin', 'POST', { body: 'Reply' })).status, 400);
  await request(path + '/status', 'admin', 'PUT', { status: 'open' });
  assert.equal((await request(path + '/messages', 'secondAdmin', 'POST', { body: 'Reply' })).status, 201);
  assert.equal((await request(path + '/messages?limit=1', 'admin')).data.pagination.total, 2);
  assert.equal((await request('/internal/threads', 'candidate')).status, 403);
});
test('internal notes are staff-only, bound to existing records and author-owned for deletion', async () => {
  const body = { entityType: 'employer', entityId: ids.employer, body: 'Verify company address' };
  assert.equal((await request('/internal/notes', 'candidate', 'POST', body)).status, 403);
  const note = await request('/internal/notes', 'admin', 'POST', body); assert.equal(note.status, 201);
  const path = `/internal/notes/${note.data.data.id}`;
  assert.equal((await request(path, 'secondAdmin', 'DELETE')).status, 403);
  assert.equal((await request(path, 'super', 'DELETE')).status, 200);
  assert.equal(rows.InternalNote.length, 0);
});
test('plan edits are validated and public plans use the persisted catalog', async () => {
  const body = { name: 'Standard revised', amountPaise: 249900, durationDays: 45, features: ['Updated support'], isActive: true, reason };
  assert.equal((await request('/admin/workspace/plans/standard', 'super', 'PATCH', { ...body, amountPaise: 1.5 })).status, 400);
  assert.equal((await request('/admin/workspace/plans/standard', 'super', 'PATCH', body)).status, 200);
  const plans = await request('/payments/plans', null); assert.equal(plans.data.data[0].amountPaise, 249900); assert.equal(plans.data.data[0].durationDays, 45);
  await request('/admin/workspace/plans/standard', 'super', 'PATCH', { ...body, isActive: false });
  assert.equal((await request('/payments/plans', null)).data.data.length, 0);
  assert.equal((await request('/payments/create-order', 'employer', 'POST', { plan: 'standard' })).status, 400);
});
test('payment verification binds user/order/amount and keeps saved price/duration after plan changes', async () => {
  const created = await request('/payments/create-order', 'employer', 'POST', { plan: 'standard', amount: 1 }); assert.equal(created.status, 200);
  const orderId = created.data.order.id, paymentId = 'pay_test';
  providerPayment = { order_id: orderId, status: 'captured', amount: 199900, currency: 'INR' };
  await (await models.SubscriptionPlan.findByPk('standard')).update({ amountPaise: 999900, durationDays: 90 });
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const body = { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, plan: 'enterprise' };
  assert.equal((await request('/payments/verify', 'otherEmployer', 'POST', body)).status, 409);
  providerPayment.amount = 1; assert.equal((await request('/payments/verify', 'employer', 'POST', body)).status, 409);
  providerPayment.amount = 199900;
  const verified = await request('/payments/verify', 'employer', 'POST', body); assert.equal(verified.status, 200); assert.equal(verified.data.plan, 'standard');
  const duration = Date.parse(verified.data.expiresAt) - Date.now(); assert.ok(duration > 29 * 86400000 && duration <= 30 * 86400000);
  const again = await request('/payments/verify', 'employer', 'POST', body); assert.equal(again.data.expiresAt, verified.data.expiresAt);
  assert.equal(rows.Payment.length, 1); assert.equal(rows.AuditLog.length, 1); assert.equal(verified.data.user.password, undefined);
});
test('infrastructure checks report status and omit secrets', async () => {
  process.env.SMTP_PASS = 'never-include-this-secret';
  const result = await request('/admin/workspace/infrastructure', 'super'); assert.equal(result.status, 200); assert.equal(result.data.data.database, 'connected');
  assert.ok(!JSON.stringify(result.data).includes('never-include-this-secret'));
});
