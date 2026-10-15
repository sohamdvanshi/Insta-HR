const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'candidate-discovery-test-secret';
const user = { id: 'employer', role: 'employer', isActive: true };
let profiles, resumes, applications, calls, queries, aiFailure;
const users = { employer: user, other: { ...user, id: 'other' }, candidate: { id: 'candidate', role: 'candidate', isActive: true }, staff: { id: 'staff', role: 'super_admin', isActive: true } };
const models = {
  User: { findByPk: async id => users[id] }, FeatureFlag: { findByPk: async () => ({ enabled: true }) },
  Job: { findByPk: async id => id === 'missing' ? null : ({ id, employerId: 'employer', requiredSkills: ['React'], description: 'React developer', minExperienceYears: 1.5 }) },
  CandidateProfile: { findAll: async q => { queries.push(['profile', q]); return profiles.filter(p => q.where.userId ? q.where.userId.includes(p.userId) : p.isResumePublic === true && p.user.isActive && p.user.role === 'candidate'); } },
  Resume: { findAll: async q => { queries.push(['resume', q]); return resumes.filter(r => r.visibility === q.where.visibility && r.user.isActive && r.user.role === 'candidate'); } },
  Application: { findAll: async q => { queries.push(['application', q]); return applications.filter(a => a.candidate.isActive && a.candidate.role === 'candidate' && (q.where?.candidateId ? q.where.candidateId.includes(a.candidateId) : q.where?.jobId ? a.jobId === q.where.jobId : a.employerId === q.include[1].where.employerId)); } }
};
function mock(file, exports) { const p = require.resolve(file); require.cache[p] = { id: p, filename: p, loaded: true, exports }; }
mock('../src/models', models); mock('../src/models/index', models);
mock('../src/config/cloudinary', { cloudinary: {} });
mock('multer-storage-cloudinary', { CloudinaryStorage: class {} });
const discovery = require('../src/services/candidateDiscovery');
const app = express(); app.use(express.json());
app.use('/employers', require('../src/routes/employer.routes'));
app.use('/candidates', require('../src/routes/candidate.routes'));
const actualFetch = global.fetch;
let server, origin;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  global.fetch = async (url, options) => {
    if (!String(url).endsWith('/match-candidates')) return actualFetch(url, options);
    const body = JSON.parse(options.body); calls.push(body);
    if (aiFailure) return { ok: aiFailure !== 'http', json: async () => aiFailure === 'partial' ? ({ success: true, data: [] }) : ({ success: false }) };
    return { ok: true, json: async () => ({ success: true, data: body.candidates.map(c => ({ candidateId: c.userId, name: `${c.firstName} ${c.lastName}`.trim(), matchScore: c.skills.includes('React') ? 90 : 10, skillScore: 80, expScore: 70, matchedSkills: ['React'], missingSkills: [] })) }) };
  };
});
after(async () => { global.fetch = actualFetch; await new Promise(resolve => server.close(resolve)); });
const actor = (id, email = `${id}@example.com`) => ({ id, email, phone: '123', role: 'candidate', isActive: true });
const profile = (id, extra = {}) => ({ id: `p-${id}`, userId: id, firstName: id, isResumePublic: true, skills: ['React'], currentLocation: 'Pune', industry: 'IT', yearsOfExperience: 2, user: actor(id), ...extra });
const resume = (id, extra = {}) => ({ id, userId: 'builder-only', visibility: 'link', title: 'Frontend Resume', personalInfo: { fullName: 'Builder Person', location: 'Mumbai' }, skills: ['React', 'TypeScript'], sector: 'information_technology', experience: [{ startDate: '2020-01-01', endDate: '2023-01-01' }], user: actor('builder-only'), ...extra });
const application = (id, extra = {}) => ({ id, candidateId: id, jobId: 'job', employerId: 'employer', status: 'hired', resumeUrl: `/uploads/${id}.pdf`, resumeText: 'React engineer', candidate: actor(id), job: { location: 'Pune', jobType: 'part-time' }, ...extra });
beforeEach(() => { profiles = []; resumes = []; applications = []; calls = []; queries = []; aiFailure = null; });
async function request(path, id = 'employer') {
  const headers = id ? { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` } : {};
  const response = await actualFetch(origin + path, { headers }); return { status: response.status, body: await response.json() };
}
test('databank includes every shared builder resume, public profile and own submitted upload without requiring a profile', async () => {
  profiles = [profile('public')]; resumes = [resume('r1'), resume('r2')]; applications = [application('applicant')];
  const result = await request('/employers/candidates'); assert.equal(result.status, 200); assert.equal(result.body.count, 3);
  assert.deepEqual(new Set(result.body.data.map(r => r.id)), new Set(['public', 'builder-only', 'applicant']));
  assert.equal(result.body.data.find(c => c.userId === 'builder-only').resumes.length, 2);
  assert.equal(result.body.data.find(c => c.userId === 'applicant').email, 'applicant@example.com');
  assert.ok(result.body.data.every(c => c.resumeText === undefined));
  assert.equal(queries.find(([name]) => name === 'resume')[1].include[0].as, 'user');
  assert.equal(queries.find(([name]) => name === 'application')[1].include[1].required, true);
});
test('private resumes, nonpublic profiles, inactive users and other employers submissions stay out of databank', async () => {
  profiles = [profile('private', { isResumePublic: false }), profile('inactive', { user: { ...actor('inactive'), isActive: false } })];
  resumes = [resume('private', { visibility: 'private' }), resume('employer-resume', { user: { ...actor('e'), role: 'employer' } })];
  applications = [application('foreign', { employerId: 'other' })];
  assert.equal((await request('/employers/candidates')).body.count, 0);
});
test('each filter uses normalized resume fields and all requested skills; clear filters returns all records', async () => {
  resumes = [resume('r1'), resume('r2', { userId: 'other-builder', personalInfo: { fullName: 'Other', location: 'Pune' }, skills: ['React'] })];
  let result = await request('/employers/candidates?keyword=builder&location=mumbai&industry=information_technology&minExperience=2.5&skills=react,typescript');
  assert.equal(result.body.count, 1); assert.equal(result.body.data[0].resumes[0].resumeId, 'r1');
  assert.equal((await request('/employers/candidates?skills=React,Python')).body.count, 0);
  assert.equal((await request('/employers/candidates?keyword=missing')).body.count, 0);
  assert.equal((await request('/employers/candidates')).body.count, 2);
  assert.equal((await request('/employers/candidates?minExperience=NaN')).status, 400);
});
test('application uploads repeat across jobs only once, distinct uploads remain available', async () => {
  applications = [application('a'), application('a', { id: 'second', jobId: 'job2' }), application('a', { id: 'third', resumeUrl: '/uploads/new.pdf' })];
  const result = await request('/employers/candidates'); assert.equal(result.body.count, 1); assert.equal(result.body.data[0].resumes.length, 2);
});
test('AI match includes hired/rejected applicants without profiles and enriches them from shared builder resumes', async () => {
  applications = [application('builder-only'), application('no-profile', { status: 'rejected' }), application('foreign', { jobId: 'different' })];
  profiles = [profile('hidden', { isResumePublic: false })]; resumes = [resume('r1'), resume('r2')];
  const result = await request('/candidates/ai-match/job'); assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.map(c => c.candidateId), ['builder-only', 'no-profile']);
  assert.equal(result.body.data[0].applicationStatus, 'hired'); assert.equal(result.body.data[1].applicationStatus, 'rejected');
  assert.equal(calls[0].candidates[0].resumeText, 'React engineer'); assert.deepEqual(calls[0].candidates[0].skills, ['React', 'TypeScript']);
  assert.equal(calls[0].job_experience_min, 1.5); assert.equal(result.body.data[0].name, 'Builder Person');
  assert.equal(calls[0].candidates[0].email, undefined); assert.equal(calls[0].candidates[0].resumeUrl, undefined);
});
test('AI discovery excludes unrelated private profiles but includes an applicants private profile for the owning job', async () => {
  profiles = [profile('applicant', { isResumePublic: false }), profile('private', { isResumePublic: false })];
  applications = [application('applicant')];
  assert.deepEqual((await request('/candidates/ai-match/job')).body.data.map(c => c.candidateId), ['applicant']);
});
test('more than 500 applicants are sent in bounded batches without dropping anyone', async () => {
  applications = Array.from({ length: 503 }, (_, i) => application(`a${i}`));
  const result = await request('/candidates/ai-match/job'); assert.equal(result.body.data.length, 503);
  assert.deepEqual(calls.map(b => b.candidates.length), [250, 250, 3]);
});
test('auth, roles and job ownership block reads and provider calls', async () => {
  assert.equal((await request('/employers/candidates', null)).status, 401);
  assert.equal((await request('/employers/candidates', 'candidate')).status, 403);
  assert.equal((await request('/candidates/ai-match/job', 'other')).status, 403);
  assert.equal((await request('/candidates/ai-match/missing')).status, 404); assert.equal(calls.length, 0);
});
test('overlapping experience periods are merged and malformed/empty records are safe', () => {
  assert.equal(discovery.experienceYears([{ startDate: '2020-01-01', endDate: '2022-01-01' }, { startDate: '2021-01-01', endDate: '2023-01-01' }, null]), 3);
  assert.equal(discovery.experienceYears(null), 0);
});

test('submitted uploads inherit searchable fields from a shared builder resume when no profile exists', async () => {
  resumes = [resume('r1')]; applications = [application('builder-only')];
  const result = await request('/employers/candidates?location=mumbai&skills=React,TypeScript&minExperience=2');
  assert.equal(result.body.count, 1); assert.equal(result.body.data[0].resumes.length, 2);
});

test('an empty eligible pool is the only case that returns an empty matching result without contacting AI', async () => {
  const result = await request('/candidates/ai-match/job');
  assert.equal(result.status, 200); assert.deepEqual(result.body.data, []); assert.equal(calls.length, 0);
});
test('provider failure and incomplete responses use labelled basic matching with all applicants', async () => {
  applications = [application('applicant')];
  for (const mode of ['http', 'invalid', 'partial']) {
    aiFailure = mode; const result = await request('/candidates/ai-match/job');
    assert.equal(result.status, 200); assert.equal(result.body.matchingMode, 'basic'); assert.equal(result.body.fallback, true); assert.equal(result.body.data.length, 1); assert.ok(Number.isFinite(result.body.data[0].matchScore));
  }
});

test('one candidate groups profile, several builder resumes and job submissions even with different editable emails', async () => {
  profiles = [profile('builder-only')]; resumes = [resume('r1'), resume('r2', { personalInfo: { fullName: 'Different spelling', email: 'fake' } })];
  applications = [application('builder-only'), application('builder-only', { id: 'a2', jobId: 'other-job', resumeUrl: '/uploads/other.pdf' })];
  const result = await request('/employers/candidates'); assert.equal(result.body.count, 1);
  assert.equal(result.body.data[0].resumes.length, 4); assert.equal(result.body.data[0].email, 'builder-only@example.com');
});
test('Mumbai resident applying to a Pune part-time job matches Pune and part-time filters even for a different employer', async () => {
  profiles = [profile('mobile', { currentLocation: 'Mumbai' })];
  applications = [application('mobile', { employerId: 'other', job: { location: 'Pune', jobType: 'part-time' }, resumeUrl: '/private.pdf' })];
  const result = await request('/employers/candidates?location=Pune&jobType=part-time');
  assert.equal(result.body.count, 1); assert.equal(result.body.data[0].currentLocation, 'Mumbai');
  assert.deepEqual(result.body.data[0].appliedLocations, ['Pune']); assert.equal(result.body.data[0].resumes.length, 0);
  assert.equal(JSON.stringify(result.body).includes('/private.pdf'), false); assert.equal(result.body.data[0].applicationId, undefined);
  assert.equal((await request('/employers/candidates?location=Mumbai')).body.count, 1);
  assert.equal((await request('/employers/candidates?jobType=full-time')).body.count, 0);
});
test('explicit preferences, education, experience range and salary filters work together', async () => {
  profiles = [profile('preferred', { preferredLocations: ['Bengaluru'], preferredJobTypes: ['full-time'], education: [{ degree: 'BTech', institution: 'College' }], expectedSalary: 45000 })];
  assert.equal((await request('/employers/candidates?location=bengaluru&jobType=full-time&education=btech&minExperience=1&maxExperience=3&maxSalary=50000')).body.count, 1);
  assert.equal((await request('/employers/candidates?maxSalary=30000')).body.count, 0);
  assert.equal((await request('/employers/candidates?minExperience=3&maxExperience=1')).status, 400);
  assert.equal((await request('/employers/candidates?jobType=invalid')).status, 400);
});
test('same name belonging to two different accounts remains two candidates', async () => {
  profiles = [profile('one', { firstName: 'Savf' }), profile('two', { firstName: 'Savf' })];
  assert.equal((await request('/employers/candidates')).body.count, 2);
});
