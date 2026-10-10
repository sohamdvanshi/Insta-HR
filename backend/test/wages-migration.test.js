const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('sequelize');
const migration = require('../migrations/20261006000100-wage-register');
const User = require('../src/models/User');
function queryInterface(exists, reference = 'users') {
  const events = [], transaction = { test: true };
  const q = {
    sequelize: { transaction: fn => fn(transaction), query: async () => [] },
    showAllTables: async () => exists ? ['Users','users','wage_registers'] : ['Users'],
    createTable: async (table, fields, options) => { events.push(['create',table,fields]); assert.equal(options.transaction, transaction); },
    addIndex: async () => events.push(['index']),
    getForeignKeyReferencesForTable: async () => [{ columnName: 'employerId', referencedTableName: reference, constraintName: 'wage_registers_employerId_fkey' }],
    removeConstraint: async (table,name,options) => { events.push(['remove',table,name]); assert.equal(options.transaction,transaction); },
    addConstraint: async (table,options) => { events.push(['add',table,options]); assert.equal(options.transaction,transaction); }
  };
  return { q,events };
}
test('fresh wage migration references the exact user table used by authentication',async()=>{
  const {q,events}=queryInterface(false);await migration.up(q,S);
  assert.equal(events[0][2].employerId.references.model,User.getTableName());
  assert.equal(User.getTableName(),'Users');assert.equal(events.length,2);
});
test('existing lowercase reference is repaired in a transaction without recreating the table',async()=>{
  const {q,events}=queryInterface(true);await migration.up(q,S);
  assert.deepEqual(events.map(e=>e[0]),['remove','add']);assert.equal(events[1][2].references.table,'Users');assert.equal(events[0][2],'wage_registers_employerId_fkey');
});
test('rerunning migration leaves a correct Users reference untouched',async()=>{
  const {q,events}=queryInterface(true,'Users');await migration.up(q,S);assert.deepEqual(events,[]);
});
