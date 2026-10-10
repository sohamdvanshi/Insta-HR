const { test, beforeEach, mock: testMock } = require('node:test'), assert = require('node:assert/strict');
testMock.method(console, 'log', () => {});
testMock.method(console, 'error', () => {});
const { randomUUID } = require('node:crypto');
let status, calls, sendFails, recipients, updates;
const employerId = randomUUID(), id = randomUUID(), jobId = randomUUID();
const campaign = { id, jobId, employerId, recipientStatus: 'shortlisted', subject: 'test', message: 'test', get status() { return status; }, update: async changes => { Object.assign(campaign, Object.fromEntries(Object.entries(changes).filter(([key]) => key !== 'status'))); if (changes.status) status = changes.status; updates.push(changes); } };
const models = {
  BulkEmailCampaign: { findByPk: async () => campaign, update: async (changes, options) => { if (status !== options.where.status) return [0]; status = changes.status; return [1]; } },
  Job: { findByPk: async () => ({ id: jobId, employerId }) }, Application: { findAll: async () => recipients }, User: {}, CandidateProfile: {}
};
const mock = (file, exports) => { const p = require.resolve(file); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
mock('../src/models', models);
mock('../src/services/email/emailService', { sendBulkCampaignEmail: async () => { calls++; if (sendFails) throw new Error('delivery rejected'); await new Promise(resolve => setImmediate(resolve)); } });
const { sendCampaign } = require('../src/controllers/bulkEmailCampaign.controller');
const request = () => ({ params: { id }, user: { id: employerId } });
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
beforeEach(() => { status = 'draft'; calls = 0; sendFails = false; updates = []; recipients = [{ candidate: { email: 'test@example.com' } }]; });
test('repeated and concurrent sends claim a campaign once', async () => {
  const first = response(), second = response(); await Promise.all([sendCampaign(request(), first), sendCampaign(request(), second)]);
  assert.equal(calls, 1); assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  const third = response(); await sendCampaign(request(), third); assert.equal(third.statusCode, 409); assert.equal(calls, 1);
});
test('campaign with no successful recipients records failed status and accurate counts', async () => {
  sendFails = true; const res = response(); await sendCampaign(request(), res); assert.equal(status, 'failed'); assert.equal(res.body.data.sentCount, 0); assert.equal(res.body.data.failedCount, 1); assert.equal(campaign.sentAt, null);
});
