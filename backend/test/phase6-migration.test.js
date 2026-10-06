const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('sequelize');
const migration = require('../migrations/20261005000100-admin-controls');

function catalog(phase5 = true) {
  const state = { tables: new Set(phase5 ? ['Users', 'Payments', 'training_batches', 'internal_threads', 'audit_logs'] : ['Users', 'Payments']), rows: { Payments: [{ id: 'historic-payment', amount: 1999 }], internal_threads: [{ id: 'historic-ticket', subject: 'Retain me' }] }, columns: { Payments: { id: {} } }, indexes: new Set() };
  const q = {
    sequelize: {
      transaction: async fn => fn({}),
      query: async sql => {
        if (sql.startsWith('SELECT name')) return [state.rows.admin_phase6_migrations || []];
        if (sql.startsWith('CREATE INDEX')) state.indexes.add(sql);
        return [[]];
      }
    },
    showAllTables: async () => [...state.tables],
    createTable: async (name, columns) => { assert.ok(!state.tables.has(name), `${name} must not be recreated`); state.tables.add(name); state.columns[name] = columns; state.rows[name] = []; },
    describeTable: async name => state.columns[name],
    addColumn: async (name, column, value) => { assert.ok(!state.columns[name][column]); state.columns[name][column] = value; },
    bulkInsert: async (name, values) => { state.rows[name].push(...values); }
  };
  return { q, state };
}
test('migration preserves existing payments/tickets, seeds defaults once and is repeatable', async () => {
  const { q, state } = catalog();
  await migration.up(q, S);
  assert.equal(state.rows.Payments[0].id, 'historic-payment');
  assert.equal(state.rows.internal_threads[0].subject, 'Retain me');
  assert.equal(state.rows.subscription_plans.length, 4);
  assert.equal(state.rows.feature_flags.length, 4);
  assert.ok(state.rows.feature_flags.every(flag => flag.enabled));
  assert.equal(state.rows.subscription_plans.find(plan => plan.id === 'premium').amountPaise, 399900);
  // Simulate a super admin editing a plan, then rerun the installation.
  state.rows.subscription_plans[0].name = 'Edited display name';
  await migration.up(q, S);
  assert.equal(state.rows.subscription_plans.length, 4);
  assert.equal(state.rows.subscription_plans[0].name, 'Edited display name');
  assert.equal(state.rows.admin_phase6_migrations.length, 1);
});
test('migration requires the Phase 5 schema and refuses destructive rollback', async () => {
  await assert.rejects(migration.up(catalog(false).q, S), /migrate:phase5/);
  await assert.rejects(migration.down(), /history must be preserved/);
});
