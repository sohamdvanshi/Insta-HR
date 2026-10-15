const { test } = require('node:test');
const assert = require('node:assert/strict');
function mock(file, exports) { const p = require.resolve(file); require.cache[p] = { id: p, filename: p, loaded: true, exports }; }
let broken = true, saved;
const profile = { update: async fields => { if (broken) { const error = new Error('database constraint details'); error.name = 'SequelizeForeignKeyConstraintError'; throw error; } saved = fields; return profile; } };
mock('../src/models/index', { CandidateProfile: { findOne: async () => profile }, Job: {} });
mock('../src/config/cloudinary', { cloudinary: {} }); mock('multer-storage-cloudinary', { CloudinaryStorage: class {} });
const controller = require('../src/controllers/candidate.controller');
const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
test('profile FK failure is actionable without exposing SQL; saving succeeds after repair and ignores spoofed ownership', async () => {
  const req = { user: { id: 'real-user' }, body: { userId: 'someone-else', firstName: 'Savf', preferredLocations: ['Pune'], preferredJobTypes: ['part-time'] } };
  let res = response(); await controller.updateProfile(req, res); assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'PROFILE_SCHEMA_MISMATCH'); assert.equal(res.body.message.includes('constraint'), false);
  broken = false; res = response(); await controller.updateProfile(req, res); assert.equal(res.body.success, true);
  assert.deepEqual(saved, { firstName: 'Savf', preferredLocations: ['Pune'], preferredJobTypes: ['part-time'] });
});
