const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const express = require('express'), jwt = require('jsonwebtoken'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instahr-audit-'));
process.env.UPLOADS_DIR = root; process.env.JWT_SECRET = 'audit-server-test';
let databaseDown = false;
const mock = (file, exports) => { const p = require.resolve(file); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const roles = { candidate: { id: 'candidate', role: 'candidate', isActive: true }, admin: { id: 'admin', role: 'admin', isActive: true } };
mock('../src/models/index', { User: { findByPk: async id => roles[id] } }); mock('../src/models', require('../src/models/index'));
mock('../src/config/database', { authenticate: async () => { if (databaseDown) throw new Error('offline'); } });
mock('../src/config/redis', { createRedisConnection: async () => null });
mock('../src/config/elasticsearch', { connectElasticsearch: async () => null });
mock('../src/services/search/jobSearch.service', { ensureJobsIndex: async () => {} });
mock('../src/cron/subscription.cron', { startSubscriptionCron: () => {} });
for (const file of fs.readdirSync(path.resolve(__dirname, '../src/routes')).filter(file => file.endsWith('.js'))) mock('../src/routes/' + file, express.Router());
const app = require('../src/server'); let server, url;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); url = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
test('health check reports a live database failure instead of claiming healthy', async () => {
  let response = await fetch(url + '/health'); assert.equal(response.status, 200); assert.equal((await response.json()).database, 'connected');
  databaseDown = true; response = await fetch(url + '/health'); assert.equal(response.status, 503); assert.equal((await response.json()).database, 'unavailable');
});
test('upload directory diagnostics are staff-only', async () => {
  assert.equal((await fetch(url + '/uploads-check')).status, 401);
  const headers = role => ({ Authorization: `Bearer ${jwt.sign({ id: role }, process.env.JWT_SECRET)}` });
  assert.equal((await fetch(url + '/uploads-check', { headers: headers('candidate') })).status, 403);
  assert.equal((await fetch(url + '/uploads-check', { headers: headers('admin') })).status, 200);
});
