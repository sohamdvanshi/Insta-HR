const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('sequelize');
const migration = require('../migrations/20261010000300-candidate-databank');
const { basicMatch, matchCandidates } = require('../src/services/candidateMatching');
const job = { requiredSkills: ['React', 'C++'], description: 'React engineer', minExperienceYears: 2 };
const candidate = { userId: 'person', firstName: 'Savf', skills: ['React'], yearsOfExperience: 2, resumeText: 'C++ React engineer', experience: [], applicationId: 'app', applicationStatus: 'hired' };
function schema({ orphanCount = 0, correct = false, fail = false } = {}) {
  const keys = [{ columnName: 'userId', constraintName: 'candidateprofiles_userId_fkey', referencedTableName: correct ? 'Users' : 'users', referencedColumnName: 'id' }];
  const columns = {}, sql = [], removed = []; let committed = false, rolledBack = false;
  const q = {
    queryGenerator: { quoteIdentifier: name => '"' + name.replace(/"/g, '""') + '"' },
    describeTable: async () => columns,
    addColumn: async (table, name) => { columns[name] = {}; },
    getForeignKeyReferencesForTable: async () => keys,
    removeConstraint: async (table, name) => { removed.push(name); keys.splice(keys.findIndex(k => k.constraintName === name), 1); },
    sequelize: {
      transaction: async callback => { try { const result = await callback({ id: 'transaction' }); committed = true; return result; } catch (error) { rolledBack = true; throw error; } },
      query: async (query, options) => {
        assert.equal(options.transaction.id, 'transaction'); sql.push(query);
        if (query.includes('ADD CONSTRAINT')) { if (fail) throw new Error('repair failed'); keys.push({ columnName: 'userId', constraintName: 'candidateprofiles_userId_Users_fkey', referencedTableName: 'Users', referencedColumnName: 'id' }); }
        return [[{ count: String(orphanCount) }]];
      }
    }
  };
  return { q, sql, keys, columns, removed, state: () => ({ committed, rolledBack }) };
}
test('migration repairs lowercase FK to canonical Users, adds preferences and is repeatable', async () => {
  const db = schema(); await migration.up(db.q, S); await migration.up(db.q, S);
  assert.deepEqual(db.removed, ['candidateprofiles_userId_fkey']);
  assert.equal(db.sql.filter(q => q.includes('ADD CONSTRAINT')).length, 1);
  assert.ok(db.sql.some(q => q.includes('REFERENCES "Users" ("id")') && q.includes('NOT VALID')));
  assert.ok(db.sql.some(q => q.includes('VALIDATE CONSTRAINT')));
  assert.deepEqual(Object.keys(db.columns).sort(), ['preferredJobTypes', 'preferredLocations']);
  assert.equal(db.state().committed, true);
});
test('historical orphans are preserved while the new FK enforces new writes', async () => {
  const db = schema({ orphanCount: 2 }); const result = await migration.up(db.q, S);
  assert.equal(result.orphanCount, 2); assert.equal(db.sql.some(q => q.includes('VALIDATE CONSTRAINT')), false);
  assert.equal(db.sql.some(q => /DELETE FROM|DROP TABLE|TRUNCATE/i.test(q)), false);
  assert.ok(db.sql.some(q => q.includes('NOT VALID')));
});
test('a correct existing FK is preserved and failed repair rolls back', async () => {
  const db = schema({ correct: true }); await migration.up(db.q, S); assert.deepEqual(db.removed, []);
  assert.equal(db.sql.some(q => q.includes('ADD CONSTRAINT')), false);
  const failed = schema({ fail: true }); await assert.rejects(migration.up(failed.q, S), /repair failed/); assert.equal(failed.state().rolledBack, true);
});
test('basic matching scores submitted text, fractional experience, and skill boundaries without NaN', () => {
  const result = basicMatch(job, candidate); assert.deepEqual(result.matchedSkills, ['react', 'c++']); assert.equal(result.matchScore, 100);
  const partial = basicMatch(job, { ...candidate, yearsOfExperience: 1.5 }); assert.equal(partial.expScore, 75);
  const boundary = basicMatch({ requiredSkills: ['java'], description: '', minExperienceYears: 0 }, { ...candidate, skills: [], resumeText: 'javascript' }); assert.deepEqual(boundary.matchedSkills, []);
  assert.equal(Number.isFinite(basicMatch({}, { userId: 'empty' }).matchScore), true);
});
test('a refused connection or timeout returns every candidate with honest basic-mode metadata', async () => {
  const saved = global.fetch;
  try {
    for (const name of ['TypeError', 'TimeoutError']) {
      global.fetch = async () => { const error = new Error('unavailable'); error.name = name; throw error; };
      const result = await matchCandidates(job, [candidate, { ...candidate, userId: 'second' }]);
      assert.equal(result.matchingMode, 'basic'); assert.equal(result.fallback, true); assert.equal(result.data.length, 2);
      assert.equal(result.data[0].applicationStatus, 'hired');
    }
  } finally { global.fetch = saved; }
});
test('healthy remote scoring stays in AI mode; malformed scores switch the whole result to basic mode', async () => {
  const saved = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: [{ ...basicMatch(job, candidate), matchScore: 81 }] }) });
    const remote = await matchCandidates(job, [candidate]); assert.equal(remote.matchingMode, 'ai'); assert.equal(remote.data[0].matchScore, 81);
    global.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: [{ ...basicMatch(job, candidate), matchScore: null }] }) });
    const fallback = await matchCandidates(job, [candidate]); assert.equal(fallback.matchingMode, 'basic'); assert.equal(fallback.data[0].matchScore, 100);
  } finally { global.fetch = saved; }
});
test('preferred job types are validated by the actual model', async () => {
  const Profile = require('../src/models/CandidateProfile');
  const p = Profile.build({ userId: 'd9447822-5917-4b71-8908-6a462aa52970', firstName: 'Savf', preferredLocations: [' Mumbai ', 'Pune'], preferredJobTypes: ['part-time'] });
  await p.validate(); assert.deepEqual(p.preferredLocations, ['Mumbai', 'Pune']);
  p.preferredJobTypes = ['anything']; await assert.rejects(p.validate(), /Invalid preferred job type/);
});
