const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monthRange, dateOnly, money, dateRange } = require('../src/services/recordValidation');
const mock = (file, exports) => { const p = require.resolve(file); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
test('month validation handles leap years, century boundaries and December without timezone drift', () => {
  for (const [month, end] of [['2024-02', '2024-02-29'], ['2023-02', '2023-02-28'], ['2100-02', '2100-02-28'], ['2024-12', '2024-12-31']]) assert.equal(monthRange(month).endDate, end);
  for (const value of [null, {}, '0000-01', '2024-1', '2024-13']) assert.throws(() => monthRange(value), error => error.status === 400);
});
test('calendar and currency validation reject malformed inputs and preserve legitimate zero amounts', () => {
  assert.equal(dateOnly('2024-02-29'), '2024-02-29');
  for (const value of ['2023-02-29', '2024-04-31', '2024-00-01', null]) assert.throws(() => dateOnly(value));
  for (const value of [true, [], {}, NaN, Infinity, -1, 10000000000, '']) assert.throws(() => money(value));
  assert.equal(money(0), 0); assert.equal(money('', true), 0); assert.equal(money('13554.10'), 13554.1);
  assert.throws(() => dateRange('2024-07-02', '2024-07-01'));
});
test('profile upload migration is additive, repeatable and preserves existing columns', async () => {
  const columns = { id: {}, userId: {}, photoUrl: { existing: true } }, added = [];
  const q = { sequelize: { transaction: callback => callback({}) }, describeTable: async () => columns, addColumn: async (table, key, definition) => { added.push([table, key]); columns[key] = definition; } };
  const migration = require('../migrations/20261010000100-phase7-audit'); const S = { STRING: length => ({ length }) };
  await migration.up(q, S); await migration.up(q, S);
  assert.deepEqual(added, [['candidateprofiles', 'photoPublicId'], ['candidateprofiles', 'resumePublicId']]); assert.equal(columns.photoUrl.existing, true);
  await assert.rejects(migration.down(), /preserved/);
});
test('candidate ORM model includes photo and resume upload metadata', () => {
  let fields; mock('../src/config/database', { define: (name, attributes) => { fields = attributes; return {}; } });
  require('../src/models/CandidateProfile'); for (const key of ['photoUrl', 'photoPublicId', 'resumePublicId']) assert.ok(fields[key]);
});
test('missing Razorpay credentials do not prevent importing payment routes', async () => {
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  mock('../src/models/index', { SubscriptionPlan: { findByPk: async () => ({ id: 'premium', isActive: true }) } });
  mock('../src/services/adminOperations', { audit: async () => {} });
  const controller = require('../src/controllers/payment.controller');
  let status, body; const response = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  await controller.createOrder({ body: { plan: 'premium' }, user: { id: 'test' } }, response); assert.equal(status, 503); assert.equal(body.success, false);
});
