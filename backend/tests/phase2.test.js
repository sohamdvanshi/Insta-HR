const test = require('node:test')
const assert = require('node:assert/strict')
const { staff, positiveInt, encrypt, decrypt, render } = require('../src/utils/phase2')
test('strict integer validation', () => {
  assert.equal(positiveInt('100'), 100)
  for (const x of [0, -1, 1.5, 'no', Infinity, 1000001]) assert.throws(() => positiveInt(x))
})
test('staff role checks include super_admin', () => {
  assert.equal(staff({ role: 'super_admin' }), true)
  assert.equal(staff({ role: 'candidate' }), false)
})
test('bank encryption is authenticated and user-bound', () => {
  process.env.PAYOUT_ENCRYPTION_KEY = 'ab'.repeat(32)
  const bank = { accountNumber: '123456789012', ifsc: 'ABCD0123456' }
  const first = encrypt(bank, 'user-a')
  assert.deepEqual(decrypt(first, 'user-a'), bank)
  assert.notEqual(first, encrypt(bank, 'user-a'))
  assert.ok(!first.includes(bank.accountNumber))
  assert.throws(() => decrypt(first, 'user-b'))
  const parts = first.split('.')
  const bytes = Buffer.from(parts[2], 'base64'); bytes[0] ^= 1; parts[2] = bytes.toString('base64')
  assert.throws(() => decrypt(parts.join('.'), 'user-a'))
  delete process.env.PAYOUT_ENCRYPTION_KEY
  assert.throws(() => encrypt(bank, 'user-a'), /not configured/)
})
test('templates are personalized without recursive replacement', () => {
  assert.equal(render('Hi {{name}}: {{points}} points', { name: 'Soham', points: 100 }), 'Hi Soham: 100 points')
  assert.equal(render('{{name}}', { name: '{{points}}', points: 100 }), '{{points}}')
  assert.throws(() => render('{{unknown}}', {}))
})

test('email text escapes markup', () => {
  const { escapeHtml } = require('../src/utils/phase2')
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;')
})
test('employer results read canonical stored screening fields', async () => {
  const Module = require('node:module')
  const fs = require('node:fs')
  const path = require('node:path')
  const source = fs.readFileSync(path.join(__dirname, '../src/controllers/aiScreening.controller.js'), 'utf8')
  const stored = { id: 'application', candidateId: 'candidate', status: 'applied', aiScore: 78, aiStatus: 'completed', screenedAt: new Date(), aiSummary: 'Stored explanation', matchedSkills: ['JavaScript'], missingSkills: ['SQL'], resumeUrl: '/uploads/resumes/test.pdf', candidate: { email: 'test@example.com', candidateProfile: {} } }
  const m = new Module('screening-test')
  m.require = name => name === '../models' ? { Job: { findByPk: async () => ({ id: 'job', employerId: 'owner', title: 'Developer' }) }, Application: { findAll: async () => [stored] }, User: {}, CandidateProfile: {} } : name === '../utils/phase2' ? { staff } : name === './application.controller' ? { updateApplicationStatus() {} } : require(name)
  m._compile(source, 'screening-test.js')
  let status = 200, body
  const res = { status(code) { status = code; return this }, json(value) { body = value; return this } }
  await m.exports.screenCandidates({ params: { jobId: 'job' }, user: { id: 'owner', role: 'employer' } }, res)
  assert.equal(body.data[0].aiScore, stored.aiScore)
  assert.equal(body.data[0].screeningComment, stored.aiSummary)
  assert.deepEqual(body.data[0].matchedSkills, stored.matchedSkills)
  stored.aiScore = null; stored.aiStatus = 'pending'; stored.screenedAt = null
  await m.exports.screenCandidates({ params: { jobId: 'job' }, user: { id: 'owner', role: 'employer' } }, res)
  assert.equal(body.data[0].aiScore, null)
  assert.equal(body.summary.avgScore, null)
  await m.exports.screenCandidates({ params: { jobId: 'job' }, user: { id: 'intruder', role: 'employer' } }, res)
  assert.equal(status, 403)
})
