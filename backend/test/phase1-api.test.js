// HTTP integration tests use the real router, JWT middleware, and controller.
// A deterministic in-memory model double keeps tests independent of live customer data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
process.env.JWT_SECRET = 'phase1-test-secret-not-for-production';
const rows = new Map();
const users = new Map([
  ['free', { id: 'free', email: 'free@example.com', role: 'candidate', isActive: true }],
  ['other', { id: 'other', email: 'other@example.com', role: 'candidate', isActive: true }],
  ['paid', { id: 'paid', email: 'paid@example.com', role: 'candidate', isActive: true, subscriptionPlan: 'premium', subscriptionExpiry: '2099-01-01' }],
  ['employer', { id: 'employer', email: 'employer@example.com', role: 'employer', isActive: true }]
]);
const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
let queue = Promise.resolve();
let userLocks = 0;
const models = {
  User: { findByPk: async (id, options) => { if (options?.transaction) { assert.equal(options.lock, 'UPDATE'); userLocks++; } return users.get(id); } },
  CandidateProfile: { findOne: async () => ({ firstName: 'Sam', lastName: 'Candidate', skills: ['SQL'], experience: [], education: [] }) },
  Resume: {
    count: async ({ where }) => [...rows.values()].filter(row => matches(row, where)).length,
    create: async value => { const row = { ...value, id: randomUUID(), toJSON() { return { ...this }; }, async update(fields) { Object.assign(this, fields); return this; } }; rows.set(row.id, row); return row; },
    findOne: async ({ where }) => [...rows.values()].find(row => matches(row, where)),
    findAll: async ({ where }) => [...rows.values()].filter(row => matches(row, where)),
    update: async (fields, { where }) => { for (const row of rows.values()) if (matches(row, where)) Object.assign(row, fields); },
    destroy: async ({ where }) => { let count = 0; for (const [id, row] of rows) if (matches(row, where)) { rows.delete(id); count++; } return count; }
  },
  sequelize: { transaction: callback => { const next = queue.then(() => callback({ LOCK: { UPDATE: 'UPDATE' } })); queue = next.catch(() => {}); return next; } }
};
require.cache[require.resolve('../src/models')] = { exports: models };
const app = express();
app.use(express.json());
app.use('/resumes', require('../src/routes/resume.routes'));
let server, base;
test.before(async () => { server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}/resumes`; });
test.after(() => new Promise(resolve => server.close(resolve)));
async function request(path = '', user, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + jwt.sign({ id: user }, process.env.JWT_SECRET) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
}
test('public samples remain accessible; candidate resume actions require authenticated candidate', async () => {
  assert.equal((await request('/catalog')).status, 200);
  assert.equal((await request('', undefined, 'POST', {})).status, 401);
  assert.equal((await request('', 'employer', 'POST', {})).status, 403);
});
test('concurrent free creates result in exactly one profile-prefilled resume', async () => {
  const results = await Promise.all([request('', 'free', 'POST', { sector: 'human_resources' }), request('', 'free', 'POST', { sector: 'retail' })]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 403]);
  const created = results.find(result => result.status === 201).data.data;
  assert.equal(created.personalInfo.fullName, 'Sam Candidate');
  assert.equal(created.personalInfo.email, 'free@example.com');
  assert.deepEqual(created.skills, ['SQL']);
  assert.equal(created.template, 'sector_human_resources');
  assert.ok(userLocks >= 2);
  assert.equal((await request('', 'free')).data.entitlement.canCreate, false);
});
test('ownership cannot be reassigned; private/public/revoked sharing and edits are enforced', async () => {
  const created = (await request('', 'other', 'POST', { title: 'Private', targetJobDescription: 'private notes' })).data.data;
  assert.equal((await request(`/${created.id}`, 'free')).status, 404);
  assert.equal((await request(`/${created.id}`, 'free', 'PUT', { title: 'stolen' })).status, 404);
  assert.equal((await request(`/${created.id}`, 'free', 'DELETE')).status, 404);
  assert.equal((await request(`/public/${created.id}`)).status, 404);
  const updated = await request(`/${created.id}`, 'other', 'PUT', { visibility: 'link', userId: 'free', title: 'Shared' });
  assert.equal(updated.data.data.userId, 'other');
  const shared = await request(`/public/${created.id}`);
  assert.equal(shared.status, 200); assert.equal(shared.cache, 'no-store');
  assert.equal(shared.data.data.title, 'Shared');
  assert.equal(shared.data.data.userId, undefined);
  assert.equal(shared.data.data.targetJobDescription, undefined);
  await request(`/${created.id}`, 'other', 'PUT', { visibility: 'private' });
  assert.equal((await request(`/public/${created.id}`)).status, 404);
  await request(`/${created.id}`, 'other', 'DELETE');
  assert.equal((await request('', 'other')).data.entitlement.canCreate, true);
});
test('premium creates multiple resumes; expiry blocks new creation but preserves editing', async () => {
  const first = await request('', 'paid', 'POST', { isDefault: true });
  const second = await request('', 'paid', 'POST', { isDefault: true });
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  const list = (await request('', 'paid')).data.data;
  assert.equal(list.filter(row => row.isDefault).length, 1);
  users.get('paid').subscriptionExpiry = '2020-01-01';
  assert.equal((await request('', 'paid', 'POST', {})).status, 403);
  assert.equal((await request(`/${first.data.data.id}`, 'paid', 'PUT', { title: 'Still editable' })).status, 200);
});
test('bad data and unknown templates fail before saving', async () => {
  assert.equal((await request('', 'other', 'POST', { skills: 'SQL' })).status, 400);
  assert.equal((await request('', 'other', 'POST', { template: 'not-a-template' })).status, 400);
  assert.equal((await request('/profile-defaults', 'other')).data.data.personalInfo.email, 'other@example.com');
});
