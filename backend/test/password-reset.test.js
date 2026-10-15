const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const { Op } = require('sequelize');
process.env.JWT_SECRET = 'password-reset-test-only-secret';
process.env.FRONTEND_URL = 'https://portal.example.test';
let account, deliveries, mailFails, writeFails, server, queue;
const matches = (where, user) => Object.entries(where).every(([key, value]) => {
  if (value && typeof value === 'object') {
    if (value[Op.gt]) return new Date(user[key]) > value[Op.gt];
    if (value[Op.lte]) return user[key] && new Date(user[key]) <= value[Op.lte];
  }
  return user[key] === value;
}) && (!where[Op.or] || where[Op.or].some(condition => matches(condition, user)));
const models = {
  User: {
    findOne: async ({ where }) => account && matches(where, account) ? account : null,
    findByPk: async id => account?.id === id ? account : null,
    update: async (values, { where }) => {
      if (writeFails) throw new Error('database unavailable');
      if (!account || !matches(where, account)) return [0];
      Object.assign(account, values); return [1];
    }
  }, CandidateProfile: {},
  sequelize: { transaction: fn => {
    const result = queue.then(async () => {
      const saved = { ...account };
      try { return await fn({ LOCK: { UPDATE: 'UPDATE' } }); }
      catch (error) { Object.assign(account, saved); throw error; }
    }); queue = result.catch(() => {}); return result;
  } }
};
function mock(file, value) { const p = require.resolve(file); require.cache[p] = { id: p, filename: p, loaded: true, exports: value }; }
mock('../src/models', models);
mock('../src/models/index', models);
mock('../src/services/email/emailService', { sendPasswordResetEmail: async (email, url) => { if (mailFails) throw new Error('SMTP unavailable'); deliveries.push({ email, url }); } });
const { protect } = require('../src/middleware/auth');

beforeEach(async () => {
  process.env.FRONTEND_URL = 'https://portal.example.test';
  queue = Promise.resolve(); deliveries = []; mailFails = false; writeFails = false;
  account = {
    id: '00000000-0000-4000-8000-000000000001', email: 'person@example.test', role: 'employer', authProvider: 'local',
    isActive: true, isEmailVerified: true, authVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null,
    password: await bcrypt.hash('old-password', 4),
    update: async function(values) { if (writeFails) throw new Error('database unavailable'); Object.assign(this, values); },
    comparePassword: async function(value) { return bcrypt.compare(value, this.password); }
  };
  const route = require.resolve('../src/routes/auth.routes'); delete require.cache[route];
  const app = express(); app.use(express.json()); app.use('/auth', require(route));
  app.get('/private', protect, (_, res) => res.json({ success: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
});
afterEach(async () => { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); });
async function request(path, body, token) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  }); return { status: response.status, body: await response.json() };
}
async function issue() {
  const response = await request('/auth/forgot-password', { email: ' PERSON@EXAMPLE.TEST ' });
  assert.equal(response.status, 200);
  return new URLSearchParams(new URL(deliveries.at(-1).url).hash.slice(1)).get('token');
}
test('forgot endpoint validates email and returns identical responses for eligible, absent and ineligible accounts', async () => {
  assert.equal((await request('/auth/forgot-password', { email: {} })).status, 400);
  const known = await request('/auth/forgot-password', { email: account.email });
  for (const change of [{ email: 'absent@example.test' }, { isActive: false }, { isEmailVerified: false }, { password: null, authProvider: 'google' }]) {
    const saved = { ...account }; Object.assign(account, change);
    assert.deepEqual(await request('/auth/forgot-password', { email: 'person@example.test' }), known);
    Object.assign(account, saved);
  }
  assert.equal(deliveries.length, 1);
  assert.ok(!JSON.stringify(known).includes('token'));
});
test('only a token digest is stored, links use configured origin and account cooldown retains the first link', async () => {
  const before = Date.now(), token = await issue();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(account.passwordResetTokenHash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.notEqual(account.passwordResetTokenHash, token);
  const url = new URL(deliveries[0].url); assert.equal(url.origin, 'https://portal.example.test');
  assert.equal(url.pathname, '/reset-password'); assert.equal(url.search, '');
  assert.ok(account.passwordResetExpiresAt.getTime() >= before + 15 * 60000);
  await request('/auth/forgot-password', { email: account.email }); assert.equal(deliveries.length, 1);
});
test('mail failure clears undelivered reset tokens and does not reveal account existence', async () => {
  mailFails = true;
  const known = await request('/auth/forgot-password', { email: account.email });
  const absent = await request('/auth/forgot-password', { email: 'missing@example.test' });
  assert.deepEqual(known, absent); assert.equal(account.passwordResetTokenHash, null); assert.equal(account.passwordResetExpiresAt, null);
});
test('reset refuses malformed, expired, inactive, unverified and replaced tokens', async () => {
  assert.equal((await request('/auth/reset-password', { token: 'bad', password: 'new-password' })).status, 400);
  const token = await issue(); const expiry = account.passwordResetExpiresAt;
  for (const change of [{ passwordResetExpiresAt: new Date(0) }, { isActive: false }, { isEmailVerified: false }, { passwordResetTokenHash: 'f'.repeat(64) }]) {
    const saved = { ...account }; Object.assign(account, change);
    assert.equal((await request('/auth/reset-password', { token, password: 'new-password' })).status, 400);
    Object.assign(account, saved);
  }
  assert.equal(account.passwordResetExpiresAt, expiry); assert.equal(account.authVersion, 0);
});
test('short, nonstring and excessive UTF-8 passwords do not consume the reset token', async () => {
  const token = await issue();
  for (const password of ['short', 12345, 'अ'.repeat(25)]) assert.equal((await request('/auth/reset-password', { token, password })).status, 400);
  assert.ok(account.passwordResetTokenHash);
  assert.equal((await request('/auth/reset-password', { token, password: 'valid-new-password' })).status, 200);
  assert.ok(await bcrypt.compare('valid-new-password', account.password));
});
test('concurrent reset uses a token once and revokes existing JWTs; new password login gets a valid session', async () => {
  const token = await issue(), oldJWT = jwt.sign({ id: account.id }, process.env.JWT_SECRET);
  assert.equal((await request('/private', null, oldJWT)).status, 200);
  const results = await Promise.all([request('/auth/reset-password', { token, password: 'new-password' }), request('/auth/reset-password', { token, password: 'different-password' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]); assert.equal(account.authVersion, 1);
  assert.equal(account.passwordResetTokenHash, null); assert.equal(account.passwordResetExpiresAt, null);
  assert.equal((await request('/private', null, oldJWT)).status, 401);
  assert.equal((await request('/auth/login', { email: account.email, password: 'old-password' })).status, 401);
  const winningPassword = results[0].status === 200 ? 'new-password' : 'different-password';
  const login = await request('/auth/login', { email: account.email, password: winningPassword });
  assert.equal(login.status, 200); assert.equal(jwt.verify(login.body.token, process.env.JWT_SECRET).authVersion, 1);
  assert.equal((await request('/private', null, login.body.token)).status, 200);
});
test('database failure rolls back reset without consuming the token', async () => {
  const token = await issue(); writeFails = true;
  assert.equal((await request('/auth/reset-password', { token, password: 'new-password' })).status, 503);
  assert.equal(account.authVersion, 0); assert.ok(account.passwordResetTokenHash);
});
test('recovery requests are limited by IP', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await request('/auth/forgot-password', { email: 'missing@example.test' })).status, 200);
  assert.equal((await request('/auth/forgot-password', { email: 'missing@example.test' })).status, 429);
});
test('migration targets Users, is additive and can be rerun', async () => {
  const columns = { id: {}, password: {} }, names = [], q = { sequelize: { transaction: fn => fn({}) }, describeTable: async table => { assert.equal(table, 'Users'); return columns; }, addColumn: async (table, name, definition) => { assert.equal(table, 'Users'); columns[name] = definition; names.push(name); } };
  const migration = require('../migrations/20261010000200-password-reset'), S = require('sequelize');
  await migration.up(q, S); await migration.up(q, S);
  assert.deepEqual(names, ['passwordResetTokenHash', 'passwordResetExpiresAt', 'authVersion']);
  assert.equal(columns.authVersion.defaultValue, 0);
});
