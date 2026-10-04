const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { Training, TrainingBatch: Batch, TrainingSession: Session, TrainingAttendance: Attendance, CourseEnrollment: Enrollment, User, sequelize } = require('../models');
const { isAdmin, ownsCourse, parseSession, canJoin } = require('../services/trainingPolicy');
const { sendTrainingSessionEmail } = require('../services/email/emailService');

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const handle = fn => async (req, res) => {
  try { await fn(req, res); } catch (error) {
    if (!error.status) console.error('Training operation:', error.message);
    const invalidId = error.original?.code === '22P02';
    res.status(error.status || (invalidId ? 400 : 500)).json({ success: false, message: error.status ? error.message : invalidId ? 'Invalid ID' : 'Unable to complete training operation' });
  }
};
const courseFor = async (user, id, allowAssignment = true) => {
  const course = await Training.findByPk(id);
  if (!course) fail('Course not found', 404);
  if (ownsCourse(user, course)) return course;
  if (allowAssignment && user.role === 'trainer' && await Batch.findOne({ where: { trainingId: id, trainerId: user.id } })) return course;
  fail('You do not manage this course', 403);
};
const batchFor = async (user, id) => {
  const batch = await Batch.findByPk(id);
  if (!batch) fail('Batch not found', 404);
  const course = await Training.findByPk(batch.trainingId);
  if (!ownsCourse(user, course) && !(user.role === 'trainer' && batch.trainerId === user.id)) fail('You do not manage this batch', 403);
  return batch;
};
const sessionFor = async (user, id) => {
  const session = await Session.findByPk(id);
  if (!session) fail('Session not found', 404);
  if (session.batchId) await batchFor(user, session.batchId);
  else await courseFor(user, session.trainingId, false);
  return session;
};
const roster = (session, transaction) => Enrollment.findAll({
  where: { trainingId: session.trainingId, status: ['active', 'completed'], ...(session.batchId ? { batchId: session.batchId } : {}) },
  include: [{ model: User, as: 'user', attributes: ['id', 'email'], where: { role: 'candidate', isActive: true } }],
  transaction, order: [['enrolledAt', 'ASC']]
});
const safeSession = session => { const data = session.toJSON(); delete data.notificationLog; delete data.meetingUrl; return data; };

// Delivery failures never roll back scheduling. A retry only targets recipients not
// successfully notified for the current session details. Row locks serialize retries.
const notifySession = async id => sequelize.transaction(async transaction => {
  const session = await Session.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  const course = await Training.findByPk(session.trainingId, { transaction });
  const recipients = await roster(session, transaction);
  const log = { ...(session.notificationLog || {}) };
  let sent = 0; let failed = 0; let skipped = 0;
  for (let offset = 0; offset < recipients.length; offset += 5) {
    await Promise.all(recipients.slice(offset, offset + 5).map(async enrollment => {
      if (log[enrollment.userId]?.sentAt) { skipped++; return; }
      try {
        await sendTrainingSessionEmail(enrollment.user.email, { ...session.toJSON(), courseTitle: course.title });
        log[enrollment.userId] = { sentAt: new Date().toISOString() }; sent++;
      } catch { log[enrollment.userId] = { error: 'Email delivery failed. Retry notifications.' }; failed++; }
    }));
  }
  await session.update({ notificationLog: log }, { transaction });
  return { sent, failed, skipped, total: recipients.length };
});
const notifyUpcoming = async where => {
  const sessions = await Session.findAll({ where: { ...where, status: ['scheduled', 'live'], endsAt: { [Op.gt]: new Date() } } });
  const results = [];
  for (const session of sessions) {
    try { results.push(await notifySession(session.id)); } catch { results.push({ failed: 1, message: 'Session saved; retry notifications from Sessions.' }); }
  }
  return results;
};

exports.notifyEnrollment = trainingId => notifyUpcoming({ trainingId, batchId: null });

exports.listStaff = handle(async (req, res) => {
  const where = { role: 'trainer', isActive: true, ...(!isAdmin(req.user) ? { id: req.user.id } : {}) };
  res.json({ success: true, data: await User.findAll({ where, attributes: ['id', 'email'], order: [['email', 'ASC']] }) });
});
exports.createTrainer = handle(async (req, res) => {
  const email = User.normalizeEmail(req.body.email);
  const password = req.body.password;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 128) fail('Provide a valid email and a password with 12–128 characters');
  if (await User.findOne({ where: { email } })) fail('An account already exists for this email', 409);
  const trainer = await User.create({ email, password: await bcrypt.hash(password, 12), role: 'trainer', isEmailVerified: true, isActive: true, authProvider: 'local' });
  res.status(201).json({ success: true, data: { id: trainer.id, email: trainer.email, role: trainer.role } });
});
exports.listBatches = handle(async (req, res) => {
  const course = await courseFor(req.user, req.params.id);
  const where = { trainingId: course.id, ...(!ownsCourse(req.user, course) ? { trainerId: req.user.id } : {}) };
  res.json({ success: true, data: await Batch.findAll({ where, include: [{ model: User, as: 'trainer', attributes: ['id', 'email'] }], order: [['createdAt', 'DESC']] }) });
});
exports.createBatch = handle(async (req, res) => {
  const course = await courseFor(req.user, req.params.id, false);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 200) fail('Batch name is required (maximum 200 characters)');
  let trainerId = req.body.trainerId || null;
  if (req.user.role === 'trainer') trainerId = req.user.id;
  if (trainerId && !await User.findOne({ where: { id: trainerId, role: 'trainer', isActive: true } })) fail('Select an active trainer');
  const batch = await Batch.create({ trainingId: course.id, name, trainerId });
  res.status(201).json({ success: true, data: batch });
});
exports.updateBatch = handle(async (req, res) => {
  const batch = await batchFor(req.user, req.params.batchId);
  await courseFor(req.user, batch.trainingId, false);
  const data = {};
  if (req.body.name !== undefined) {
    if (typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 200) fail('Invalid batch name');
    data.name = req.body.name.trim();
  }
  if (req.body.status !== undefined) {
    if (!['active', 'archived'].includes(req.body.status)) fail('Invalid batch status');
    if (req.body.status === 'archived' && await Session.count({ where: { batchId: batch.id, status: ['scheduled', 'live'] } })) fail('Complete or cancel pending sessions before archiving this batch');
    data.status = req.body.status;
  }
  if (req.body.trainerId !== undefined) {
    if (!isAdmin(req.user) && req.body.trainerId !== req.user.id) fail('Only admins can reassign trainers', 403);
    if (req.body.trainerId && !await User.findOne({ where: { id: req.body.trainerId, role: 'trainer', isActive: true } })) fail('Select an active trainer');
    data.trainerId = req.body.trainerId || null;
  }
  await batch.update(data);
  res.json({ success: true, data: batch });
});
exports.listEnrollments = handle(async (req, res) => {
  const course = await courseFor(req.user, req.params.id);
  const where = { trainingId: course.id, status: ['active', 'completed'] };
  if (!ownsCourse(req.user, course)) {
    const batches = await Batch.findAll({ where: { trainingId: course.id, trainerId: req.user.id } });
    where.batchId = { [Op.in]: batches.map(batch => batch.id) };
  }
  res.json({ success: true, data: await Enrollment.findAll({ where, include: [{ model: User, as: 'user', attributes: ['id', 'email'], where: { role: 'candidate', isActive: true } }], order: [['enrolledAt', 'ASC']] }) });
});
exports.grantEnrollment = handle(async (req, res) => {
  await courseFor(req.user, req.params.id, false);
  const user = await User.findOne({ where: { email: User.normalizeEmail(req.body.email), role: 'candidate', isActive: true } });
  if (!user) fail('Active candidate account not found', 404);
  const enrollment = await sequelize.transaction(async transaction => {
    const course = await Training.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (course.status !== 'active') fail('Activate this course before enrolling candidates');
    const [record] = await Enrollment.findOrCreate({ where: { userId: user.id, trainingId: course.id }, defaults: { status: 'active' }, transaction });
    if (record.status === 'cancelled') await record.update({ status: 'active' }, { transaction });
    await course.update({ enrollmentCount: await Enrollment.count({ where: { trainingId: course.id, status: ['active', 'completed'] }, transaction }) }, { transaction });
    return record;
  });
  res.json({ success: true, data: enrollment, notifications: await notifyUpcoming({ trainingId: req.params.id, batchId: null }) });
});
exports.setMembers = handle(async (req, res) => {
  const batch = await batchFor(req.user, req.params.batchId);
  await courseFor(req.user, batch.trainingId, false);
  if (batch.status !== 'active') fail('This batch is archived');
  const ids = req.body.userIds;
  if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) fail('Select a valid list of candidates');
  await sequelize.transaction(async transaction => {
    await Training.findByPk(batch.trainingId, { transaction, lock: transaction.LOCK.UPDATE });
    const enrolled = await Enrollment.findAll({ where: { trainingId: batch.trainingId, userId: { [Op.in]: ids }, status: ['active', 'completed'] }, include: [{ model: User, as: 'user', attributes: ['id'], where: { role: 'candidate', isActive: true } }], transaction });
    if (enrolled.length !== ids.length) fail('Every batch member must be enrolled in this course');
    await Enrollment.update({ batchId: null }, { where: { trainingId: batch.trainingId, batchId: batch.id, ...(ids.length ? { userId: { [Op.notIn]: ids } } : {}) }, transaction });
    if (ids.length) await Enrollment.update({ batchId: batch.id }, { where: { trainingId: batch.trainingId, userId: { [Op.in]: ids } }, transaction });
  });
  res.json({ success: true, notifications: await notifyUpcoming({ batchId: batch.id }) });
});
exports.listSessions = handle(async (req, res) => {
  const course = await courseFor(req.user, req.params.id);
  const where = { trainingId: course.id };
  if (!ownsCourse(req.user, course)) {
    const batches = await Batch.findAll({ where: { trainingId: course.id, trainerId: req.user.id } });
    where.batchId = { [Op.in]: batches.map(batch => batch.id) };
  }
  res.json({ success: true, data: await Session.findAll({ where, include: [{ model: Batch, as: 'batch', attributes: ['id', 'name'] }], order: [['startsAt', 'ASC']] }) });
});
exports.createSession = handle(async (req, res) => {
  if (req.body.batchId) {
    const batch = await batchFor(req.user, req.body.batchId);
    if (batch.trainingId !== req.params.id || batch.status !== 'active') fail('Select an active batch belonging to this course');
  } else await courseFor(req.user, req.params.id, false);
  const course = await Training.findByPk(req.params.id);
  if (!course || course.status !== 'active') fail('Activate this course before scheduling classes');
  let data;
  try { data = parseSession(req.body); } catch (error) { fail(error.message); }
  if (new Date(data.startsAt) <= new Date()) fail('Schedule a future start time');
  const session = await Session.create({ ...data, trainingId: req.params.id, batchId: req.body.batchId || null, createdBy: req.user.id });
  let notifications;
  try { notifications = await notifySession(session.id); } catch { notifications = { failed: 1, message: 'Session saved; retry notifications.' }; }
  res.status(201).json({ success: true, data: session, notifications });
});
exports.updateSession = handle(async (req, res) => {
  // Check scope again after acquiring the session lock so concurrent start/end
  // requests cannot overwrite a terminal status.
  const result = await sequelize.transaction(async transaction => {
    await sessionFor(req.user, req.params.sessionId);
    const session = await Session.findByPk(req.params.sessionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (['completed', 'cancelled'].includes(session.status)) fail('This session is closed');
    if (req.body.batchId !== undefined && (req.body.batchId || null) !== session.batchId) fail('A session audience cannot be changed. Cancel it and schedule a new session.');
    let data;
    try { data = parseSession(req.body, session.toJSON()); } catch (error) { fail(error.message); }
    if (data.status === 'live' && (new Date(session.startsAt) > new Date() || new Date(session.endsAt) <= new Date())) fail('Start the class during its scheduled time');
    if (session.status === 'live' && Object.keys(data).some(key => !['status', 'location', 'meetingUrl'].includes(key))) fail('End the live class before changing its schedule');
    const changes = Object.keys(data).some(key => String(data[key] ?? '') !== String(session[key] ?? ''));
    await session.update({ ...data, ...(changes ? { notificationLog: {} } : {}) }, { transaction });
    return { session, notify: changes && data.status !== 'completed' };
  });
  let notifications;
  if (result.notify) {
    try { notifications = await notifySession(result.session.id); } catch { notifications = { failed: 1, message: 'Session saved; retry notifications.' }; }
  }
  res.json({ success: true, data: result.session, notifications });
});
exports.notify = handle(async (req, res) => {
  const session = await sessionFor(req.user, req.params.sessionId);
  res.json({ success: true, notifications: await notifySession(session.id) });
});
exports.mySessions = handle(async (req, res) => {
  const enrollments = await Enrollment.findAll({ where: { userId: req.user.id, status: ['active', 'completed'] } });
  if (!enrollments.length) return res.json({ success: true, data: [] });
  const sessions = await Session.findAll({
    where: { [Op.or]: enrollments.map(item => ({ trainingId: item.trainingId, [Op.or]: [{ batchId: null }, ...(item.batchId ? [{ batchId: item.batchId }] : [])] })) },
    include: [{ model: Training, as: 'training', attributes: ['id', 'title'], where: { status: 'active' } }, { model: Batch, as: 'batch', attributes: ['id', 'name'] }],
    order: [['startsAt', 'ASC']]
  });
  const attendance = await Attendance.findAll({ where: { userId: req.user.id, sessionId: { [Op.in]: sessions.map(item => item.id) } } });
  res.json({ success: true, data: sessions.map(item => ({ ...safeSession(item), attendance: attendance.find(record => record.sessionId === item.id)?.status || 'unmarked' })) });
});
exports.join = handle(async (req, res) => {
  const session = await Session.findByPk(req.params.sessionId);
  if (!session) fail('Session not found', 404);
  if (req.user.role !== 'candidate') {
    await sessionFor(req.user, session.id);
    if (session.mode !== 'online' || !['scheduled', 'live'].includes(session.status) || new Date(session.endsAt) <= new Date()) fail('This online session is closed');
  } else {
    const course = await Training.findByPk(session.trainingId);
    if (!course || course.status !== 'active') fail('Course unavailable', 403);
    const enrollment = await Enrollment.findOne({ where: { userId: req.user.id, trainingId: session.trainingId } });
    if (!canJoin(session, enrollment)) fail('The class must be live and you must be enrolled in its course and batch', 403);
  }
  res.json({ success: true, data: { meetingUrl: session.meetingUrl } });
});
exports.getAttendance = handle(async (req, res) => {
  const session = await sessionFor(req.user, req.params.sessionId);
  const members = await roster(session);
  const records = await Attendance.findAll({ where: { sessionId: session.id }, include: [{ model: User, as: 'student', attributes: ['id', 'email'] }] });
  const data = members.map(item => ({ userId: item.userId, email: item.user.email, status: records.find(record => record.userId === item.userId)?.status || 'unmarked', notes: records.find(record => record.userId === item.userId)?.notes || '' }));
  // Keep historical attendance visible after a candidate moves to another batch.
  for (const record of records) if (!data.some(item => item.userId === record.userId)) data.push({ userId: record.userId, email: record.student?.email || 'Former member', status: record.status, notes: record.notes, historical: true });
  res.json({ success: true, data });
});
exports.saveAttendance = handle(async (req, res) => {
  const session = await sessionFor(req.user, req.params.sessionId);
  if (session.status === 'cancelled' || new Date(session.startsAt) > new Date()) fail('Attendance is available after the class starts');
  const members = await roster(session);
  const ids = new Set(members.map(item => item.userId));
  const records = req.body.records;
  if (!Array.isArray(records) || records.length > 1000 || records.some(item => !item || !ids.has(item.userId) || !['present', 'absent', 'excused'].includes(item.status) || (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 1000))) || new Set(records.map(item => item.userId)).size !== records.length) fail('Attendance contains invalid or duplicate members');
  await sequelize.transaction(async transaction => {
    await Session.findByPk(session.id, { transaction, lock: transaction.LOCK.UPDATE });
    for (const record of records) await Attendance.upsert({ sessionId: session.id, userId: record.userId, markedBy: req.user.id, status: record.status, notes: record.notes || '' }, { transaction });
  });
  res.json({ success: true, message: 'Attendance saved' });
});
