// Real Express routes and JWT middleware, with an in-memory ORM and mocked mail.
// These tests do not connect to a database, upload media, or send real email.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { randomUUID } = require('crypto');
process.env.JWT_SECRET = 'phase5-test-secret';
const sentMail = [];
let mailFails = false;
const rows = {};
function matches(row, where = {}) {
  return Reflect.ownKeys(where).every(key => {
    if (key === Op.or) return where[key].some(condition => matches(row, condition));
    if (key === Op.and) return where[key].every(condition => matches(row, condition));
    const expected = where[key]; const value = row[key];
    if (Array.isArray(expected)) return expected.includes(value);
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      return Reflect.ownKeys(expected).every(operator => {
        if (operator === Op.in) return expected[operator].includes(value);
        if (operator === Op.notIn) return !expected[operator].includes(value);
        if (operator === Op.gt) return new Date(value) > new Date(expected[operator]);
        return value === expected[operator];
      });
    }
    return value === expected;
  });
}
function model(name) {
  rows[name] = [];
  const defaults = { Training: { status: 'active', type: 'video', isFree: true, price: 0, skills: [], curriculum: [], enrollmentCount: 0 }, TrainingBatch: { status: 'active', trainerId: null }, TrainingSession: { status: 'scheduled', notificationLog: {}, batchId: null }, CourseEnrollment: { status: 'active', batchId: null } };
  const prepare = data => {
    const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...defaults[name], ...data };
    Object.defineProperties(row, {
      toJSON: { value() { return JSON.parse(JSON.stringify({ ...this })); } },
      update: { value: async function(data) { Object.assign(this, data); return this; } },
      destroy: { value: async function() { rows[name] = rows[name].filter(item => item.id !== this.id); } },
      comparePassword: { value: async function(password) { return this.password ? bcrypt.compare(password, this.password) : false; } }
    });
    rows[name].push(row); return row;
  };
  const api = {
    name, prepare,
    findByPk: async id => rows[name].find(row => row.id === id) || null,
    findAll: async ({ where, include = [] } = {}) => {
      const found = [];
      for (const row of rows[name].filter(item => matches(item, where))) {
        let eligible = true;
        for (const association of include) {
          const foreignKey = { user: 'userId', student: 'userId', training: 'trainingId', trainer: 'trainerId', batch: 'batchId' }[association.as];
          const related = await association.model.findByPk(row[foreignKey]);
          if (association.where && (!related || !matches(related, association.where))) { eligible = false; break; }
          row[association.as] = related && (association.attributes ? Object.fromEntries(association.attributes.map(key => [key, related[key]])) : related);
        }
        if (eligible) found.push(row);
      }
      return found;
    },
    findOne: async options => (await api.findAll(options))[0] || null,
    count: async options => (await api.findAll(options)).length,
    create: async data => prepare(data),
    update: async (data, { where }) => { const found = await api.findAll({ where }); for (const row of found) await row.update(data); return [found.length]; },
    findOrCreate: async ({ where, defaults: values }) => { const existing = await api.findOne({ where }); return existing ? [existing, false] : [prepare({ ...values, ...where }), true]; },
    upsert: async data => { const existing = rows[name].find(row => row.sessionId === data.sessionId && row.userId === data.userId); return [existing ? await existing.update(data) : prepare(data), !existing]; }
  };
  return api;
}
const models = Object.fromEntries(['Training', 'TrainingBatch', 'TrainingSession', 'TrainingAttendance', 'CourseEnrollment', 'User', 'CandidateProfile', 'EmployerProfile', 'CourseProgress', 'CourseQuiz', 'CourseQuizQuestion', 'CourseQuizAttempt'].map(name => [name, model(name)]));
models.User.normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : null;
models.sequelize = { transaction: async fn => fn({ LOCK: { UPDATE: 'UPDATE' } }) };
require.cache[require.resolve('../src/models/index')] = { exports: models };
require.cache[require.resolve('../src/services/email/emailService')] = { exports: {
  sendTrainingSessionEmail: async (email, details) => { if (mailFails) throw new Error('SMTP unavailable'); sentMail.push({ email, details }); },
  sendOTPEmail: async () => {}, sendWelcomeEmail: async () => {}
} };
const app = express();
app.use(express.json());
app.use('/api/v1/training', require('../src/routes/training.routes'));
app.use('/api/v1/auth', require('../src/routes/auth.routes'));
app.get('/api/v1/private', require('../src/middleware/auth').protect, (req, res) => res.json({ success: true }));
let server; let base;
const ids = Object.fromEntries(['admin', 'trainer', 'otherTrainer', 'candidate', 'otherCandidate', 'course', 'ownCourse', 'otherCourse', 'batch', 'otherBatch', 'session'].map(key => [key, randomUUID()]));
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}/api/v1`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  for (const key of Object.keys(rows)) rows[key] = [];
  sentMail.length = 0; mailFails = false;
  for (const [key, role] of [['admin', 'admin'], ['trainer', 'trainer'], ['otherTrainer', 'trainer'], ['candidate', 'candidate'], ['otherCandidate', 'candidate']]) models.User.prepare({ id: ids[key], email: `${key}@example.com`, role, isActive: true, isEmailVerified: true, referralCode: 'INSTATEST' });
  models.Training.prepare({ id: ids.course, title: 'Safety', description: 'Safety training', providerId: ids.admin, videoUrl: 'https://media.example/video.mp4', liveLink: 'https://meeting.example/secret' });
  models.Training.prepare({ id: ids.ownCourse, title: 'Trainer course', description: 'Content', providerId: ids.trainer });
  models.Training.prepare({ id: ids.otherCourse, title: 'Other course', description: 'Content', providerId: ids.otherTrainer });
  models.TrainingBatch.prepare({ id: ids.batch, name: 'Morning', trainingId: ids.course, trainerId: ids.trainer });
  models.TrainingBatch.prepare({ id: ids.otherBatch, name: 'Evening', trainingId: ids.course, trainerId: ids.otherTrainer });
  models.CourseEnrollment.prepare({ userId: ids.candidate, trainingId: ids.course, batchId: ids.batch });
  models.CourseEnrollment.prepare({ userId: ids.otherCandidate, trainingId: ids.course, batchId: ids.otherBatch });
  models.TrainingSession.prepare({ id: ids.session, trainingId: ids.course, batchId: ids.batch, createdBy: ids.admin, title: 'Live safety', mode: 'online', meetingUrl: 'https://meet.example/class', status: 'live', startsAt: new Date(Date.now() - 600000), endsAt: new Date(Date.now() + 3600000) });
});
async function request(path, role, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers.Authorization = `Bearer ${jwt.sign({ id: ids[role] || role }, process.env.JWT_SECRET)}`;
  const response = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
const physical = () => ({ title: 'Physical practice', batchId: ids.batch, mode: 'physical', location: 'Room 2, Pune training centre', startsAt: new Date(Date.now() + 600000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() });

test('public course responses omit video and meeting links; enrolled content requires auth', async () => {
  for (const path of ['/training', `/training/${ids.course}`]) {
    const response = await request(path);
    const courses = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
    assert.equal(response.status, 200);
    assert.ok(courses.every(course => !('videoUrl' in course) && !('liveLink' in course)));
  }
  assert.equal((await request(`/training/${ids.course}/content`)).status, 401);
  assert.equal((await request(`/training/${ids.course}/content`, 'candidate')).data.data.videoUrl, 'https://media.example/video.mp4');
  assert.equal((await request(`/training/${ids.ownCourse}/content`, 'candidate')).status, 403);
});
test('trainer sees owned and assigned courses, cannot edit another owner or reach nontraining APIs', async () => {
  const list = await request('/training/manage/courses', 'trainer');
  assert.deepEqual(new Set(list.data.data.map(course => course.id)), new Set([ids.course, ids.ownCourse]));
  assert.equal((await request(`/training/${ids.course}`, 'trainer', 'PUT', { title: 'Hijacked' })).status, 403);
  assert.equal((await request(`/training/${ids.otherCourse}/sessions`, 'trainer')).status, 403);
  assert.equal((await request('/private', 'trainer')).status, 403);
  assert.equal((await request('/training/staff', 'candidate')).status, 403);
});
test('admin creates password trainer account; new trainer can use normal password login', async () => {
  const response = await request('/training/staff', 'admin', 'POST', { email: 'newtrainer@example.com', password: 'LongTrainerPassword42' });
  assert.equal(response.status, 201);
  assert.equal(response.data.data.role, 'trainer');
  assert.equal(response.data.data.password, undefined);
  const created = await models.User.findByPk(response.data.data.id);
  assert.notEqual(created.password, 'LongTrainerPassword42');
  assert.ok(await bcrypt.compare('LongTrainerPassword42', created.password));
  const login = await request('/auth/login', null, 'POST', { email: created.email, password: 'LongTrainerPassword42' });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'trainer');
  assert.ok(login.data.token);
  assert.equal((await request('/training/staff', 'trainer', 'POST', { email: 'forbidden@example.com', password: 'LongTrainerPassword42' })).status, 403);
  assert.equal((await request('/auth/register', null, 'POST', { email: 'publictrainer@example.com', password: 'LongTrainerPassword42', role: 'trainer' })).status, 400);
});
test('course creation rejects live toggle and malformed curriculum; ignores ownership/count injection', async () => {
  assert.equal((await request('/training', 'trainer', 'POST', { title: 'Bad', description: 'Bad', type: 'live' })).status, 400);
  assert.equal((await request('/training', 'trainer', 'POST', { title: 'Bad', description: 'Bad', curriculum: '{' })).status, 400);
  const response = await request('/training', 'trainer', 'POST', { title: 'New', description: 'Course', isFree: 'false', price: '100', providerId: ids.otherTrainer, enrollmentCount: 999 });
  assert.equal(response.status, 201);
  assert.equal(response.data.data.providerId, ids.trainer);
  assert.equal(response.data.data.enrollmentCount, 0);
  assert.equal(response.data.data.isFree, false);
  assert.equal((await request(`/training/${ids.course}`, 'admin', 'DELETE')).status, 400);
});
test('free enrollment is repeatable without duplicate counts; paid enrollment needs staff approval', async () => {
  assert.equal((await request(`/training/${ids.ownCourse}/enroll`, 'candidate', 'POST')).status, 200);
  assert.equal((await request(`/training/${ids.ownCourse}/enroll`, 'candidate', 'POST')).status, 200);
  assert.equal(rows.CourseEnrollment.filter(row => row.trainingId === ids.ownCourse).length, 1);
  assert.equal((await models.Training.findByPk(ids.ownCourse)).enrollmentCount, 1);
  await (await models.Training.findByPk(ids.otherCourse)).update({ isFree: false, price: 100 });
  assert.equal((await request(`/training/${ids.otherCourse}/enroll`, 'candidate', 'POST')).status, 402);
  assert.equal((await request(`/training/${ids.otherCourse}/enrollments`, 'admin', 'POST', { email: 'candidate@example.com' })).status, 200);
  assert.equal(rows.CourseEnrollment.filter(row => row.trainingId === ids.otherCourse).length, 1);
});
test('physical schedule requires location and notifies only its batch members', async () => {
  assert.equal((await request(`/training/${ids.course}/sessions`, 'admin', 'POST', { ...physical(), location: '' })).status, 400);
  const response = await request(`/training/${ids.course}/sessions`, 'admin', 'POST', physical());
  assert.equal(response.status, 201);
  assert.equal(response.data.notifications.sent, 1);
  assert.equal(sentMail[0].email, 'candidate@example.com');
  assert.equal(sentMail[0].details.location, physical().location);
  assert.equal((await request(`/training/${ids.course}/sessions`, 'trainer', 'POST', { ...physical(), batchId: ids.otherBatch })).status, 403);
});
test('mail outage keeps class saved; retries skip previously delivered recipients', async () => {
  mailFails = true;
  const created = await request(`/training/${ids.course}/sessions`, 'admin', 'POST', physical());
  assert.equal(created.status, 201);
  assert.equal(created.data.notifications.failed, 1);
  assert.ok(await models.TrainingSession.findByPk(created.data.data.id));
  mailFails = false;
  const retried = await request(`/training/sessions/${created.data.data.id}/notify`, 'admin', 'POST');
  assert.equal(retried.data.notifications.sent, 1);
  const again = await request(`/training/sessions/${created.data.data.id}/notify`, 'admin', 'POST');
  assert.equal(again.data.notifications.skipped, 1);
  assert.equal(sentMail.length, 1);
});
test('join link requires a live online class and correct candidate batch', async () => {
  assert.equal((await request(`/training/sessions/${ids.session}/join`, 'candidate')).status, 200);
  assert.equal((await request(`/training/sessions/${ids.session}/join`, 'otherCandidate')).status, 403);
  assert.equal((await request(`/training/sessions/${ids.session}/join`)).status, 401);
  const mine = await request('/training/my/classes', 'candidate');
  assert.equal(mine.data.data.length, 1);
  assert.ok(!('meetingUrl' in mine.data.data[0]));
  assert.ok(!('notificationLog' in mine.data.data[0]));
  await (await models.TrainingSession.findByPk(ids.session)).update({ status: 'scheduled' });
  assert.equal((await request(`/training/sessions/${ids.session}/join`, 'candidate')).status, 403);
});
test('class start/end/cancel transitions enforce schedule and ownership', async () => {
  const session = await models.TrainingSession.findByPk(ids.session);
  await session.update({ status: 'scheduled', startsAt: new Date(Date.now() + 600000) });
  assert.equal((await request(`/training/sessions/${ids.session}`, 'trainer', 'PATCH', { status: 'live' })).status, 400);
  await session.update({ startsAt: new Date(Date.now() - 600000) });
  assert.equal((await request(`/training/sessions/${ids.session}`, 'trainer', 'PATCH', { status: 'live' })).status, 200);
  assert.equal((await request(`/training/sessions/${ids.session}`, 'otherTrainer', 'PATCH', { status: 'completed' })).status, 403);
  assert.equal((await request(`/training/sessions/${ids.session}`, 'trainer', 'PATCH', { status: 'completed' })).status, 200);
  assert.equal((await request(`/training/sessions/${ids.session}`, 'trainer', 'PATCH', { status: 'live' })).status, 400);
});
test('assigned trainer can mark its trainees; outside and duplicate records are rejected', async () => {
  const path = `/training/sessions/${ids.session}/attendance`;
  assert.equal((await request(path, 'trainer', 'PUT', { records: [{ userId: ids.otherCandidate, status: 'present' }] })).status, 400);
  assert.equal((await request(path, 'trainer', 'PUT', { records: [{ userId: ids.candidate, status: 'present' }, { userId: ids.candidate, status: 'absent' }] })).status, 400);
  assert.equal((await request(path, 'otherTrainer')).status, 403);
  assert.equal((await request(path, 'trainer', 'PUT', { records: [{ userId: ids.candidate, status: 'present', notes: 'On time' }] })).status, 200);
  const roster = await request(path, 'trainer');
  assert.equal(roster.data.data[0].status, 'present');
  assert.equal((await request('/training/my/classes', 'candidate')).data.data[0].attendance, 'present');
});
test('batch changes reject nonenrolled candidates and assignment cannot cross course boundaries', async () => {
  assert.equal((await request(`/training/batches/${ids.batch}/members`, 'trainer', 'PUT', { userIds: [ids.candidate] })).status, 403);
  assert.equal((await request(`/training/batches/${ids.batch}/members`, 'admin', 'PUT', { userIds: [ids.admin] })).status, 400);
  const response = await request(`/training/batches/${ids.batch}/members`, 'admin', 'PUT', { userIds: [ids.candidate, ids.otherCandidate] });
  assert.equal(response.status, 200);
  assert.equal(rows.CourseEnrollment.find(row => row.userId === ids.otherCandidate).batchId, ids.batch);
  assert.equal((await request(`/training/${ids.ownCourse}/sessions`, 'admin', 'POST', physical())).status, 400);
});
