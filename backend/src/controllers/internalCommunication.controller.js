const { Op } = require('sequelize');
const M = require('../models');
const { InternalThread: Thread, InternalMessage: Message, InternalNote: Note, User, sequelize } = M;
const { fail, id, text, pagination } = require('../services/adminPolicy');
const { handle, audit } = require('../services/adminOperations');
const categories = ['general', 'support', 'candidate', 'employer', 'job', 'application', 'payment', 'payroll', 'referral', 'fraud'];
const statuses = ['open', 'in_progress', 'resolved', 'closed'];
const priorities = ['low', 'normal', 'high', 'urgent'];
const relation = async (type, entityId, transaction) => {
  id(entityId);
  const models = { user: User, candidate: User, employer: User, job: M.Job, application: M.Application, payment: M.Payment, ticket: Thread, payroll: M.Payroll, invoice: M.Invoice, deployment: M.Deployment, fraud: M.FraudAlert };
  if (!models[type]) fail('Unsupported linked record type');
  const record = await models[type].findByPk(entityId, { transaction });
  if (!record || (['candidate', 'employer'].includes(type) && record.role !== type)) fail('Linked record not found', 404);
  return record;
};
const person = as => ({ model: User, as, attributes: ['id', 'email', 'role'], required: false });
const includes = [person('creator'), person('assignee')];
const paged = async (model, req, res, options = {}) => {
  const p = pagination(req.query);
  const result = await model.findAndCountAll({ ...options, limit: p.limit, offset: p.offset, distinct: true });
  res.json({ success: true, data: result.rows, pagination: { page: p.page, limit: p.limit, total: result.count, pages: Math.ceil(result.count / p.limit) } });
};
const assignee = async (value, transaction) => {
  if (!value) return null;
  const user = await User.findOne({ where: { id: id(value), role: ['admin', 'super_admin'], isActive: true }, transaction });
  if (!user) fail('Select an active admin or super admin');
  return user.id;
};
exports.listThreads = handle(async (req, res) => {
  const where = {};
  for (const [key, allowed] of [['status', statuses], ['priority', priorities], ['category', categories]]) if (req.query[key]) {
    if (!allowed.includes(req.query[key])) fail(`Invalid ${key}`); where[key] = req.query[key];
  }
  if (req.query.assignedTo) where.assignedTo = id(req.query.assignedTo);
  if (req.query.relatedEntityType || req.query.relatedEntityId) {
    await relation(req.query.relatedEntityType, req.query.relatedEntityId);
    where.relatedEntityType = req.query.relatedEntityType; where.relatedEntityId = req.query.relatedEntityId;
  }
  if (req.query.q) where.subject = { [Op.iLike]: `%${text(req.query.q, 'Search', 200).replace(/[\\%_]/g, '\\$&')}%` };
  await paged(Thread, req, res, { where, include: includes, order: [['updatedAt', 'DESC'], ['id', 'ASC']] });
});
exports.createThread = handle(async (req, res) => {
  const subject = text(req.body.subject, 'Subject', 200), body = text(req.body.body, 'Message');
  const category = req.body.category || 'general', priority = req.body.priority || 'normal';
  if (!categories.includes(category) || !priorities.includes(priority)) fail('Invalid category or priority');
  const data = await sequelize.transaction(async transaction => {
    const relatedEntityType = req.body.relatedEntityType || null, relatedEntityId = req.body.relatedEntityId || null;
    if (relatedEntityType || relatedEntityId) await relation(relatedEntityType, relatedEntityId, transaction);
    const assignedTo = await assignee(req.body.assignedTo, transaction);
    const thread = await Thread.create({ subject, category, priority, status: 'open', createdBy: req.user.id, assignedTo, relatedEntityType, relatedEntityId }, { transaction });
    await Message.create({ threadId: thread.id, senderId: req.user.id, body }, { transaction });
    await audit(req, transaction, 'internal.ticket_created', 'ticket', thread.id, { relatedEntityType, relatedEntityId });
    return thread;
  });
  res.status(201).json({ success: true, data });
});
exports.getThread = handle(async (req, res) => {
  const thread = await Thread.findByPk(id(req.params.id), { include: includes });
  if (!thread) fail('Ticket not found', 404);
  res.json({ success: true, data: thread });
});
exports.listMessages = handle(async (req, res) => {
  if (!await Thread.findByPk(id(req.params.id))) fail('Ticket not found', 404);
  await paged(Message, req, res, { where: { threadId: req.params.id }, include: [person('sender')], order: [['createdAt', 'DESC'], ['id', 'ASC']] });
});
exports.addMessage = handle(async (req, res) => {
  const body = text(req.body.body, 'Message');
  const data = await sequelize.transaction(async transaction => {
    const thread = await Thread.findByPk(id(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
    if (!thread) fail('Ticket not found', 404);
    if (thread.status === 'closed') fail('Reopen this ticket before replying');
    const message = await Message.create({ threadId: thread.id, senderId: req.user.id, body }, { transaction });
    await thread.update({ status: thread.status === 'open' ? 'in_progress' : thread.status, updatedAt: new Date() }, { transaction });
    await audit(req, transaction, 'internal.ticket_reply', 'ticket', thread.id, { messageId: message.id });
    return message;
  });
  res.status(201).json({ success: true, data });
});
exports.updateThreadStatus = handle(async (req, res) => {
  if (!statuses.includes(req.body.status)) fail('Invalid ticket status');
  const data = await sequelize.transaction(async transaction => {
    const thread = await Thread.findByPk(id(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
    if (!thread) fail('Ticket not found', 404);
    const before = thread.status; await thread.update({ status: req.body.status }, { transaction });
    await audit(req, transaction, 'internal.ticket_status', 'ticket', thread.id, { before, after: thread.status });
    return thread;
  });
  res.json({ success: true, data });
});
exports.assignThread = handle(async (req, res) => {
  const data = await sequelize.transaction(async transaction => {
    const thread = await Thread.findByPk(id(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
    if (!thread) fail('Ticket not found', 404);
    const assignedTo = await assignee(req.body.assignedTo, transaction), before = thread.assignedTo;
    await thread.update({ assignedTo }, { transaction });
    await audit(req, transaction, 'internal.ticket_assigned', 'ticket', thread.id, { before, after: assignedTo });
    return thread;
  });
  res.json({ success: true, data });
});
exports.listStaff = handle(async (req, res) => res.json({ success: true, data: await User.findAll({ where: { role: ['admin', 'super_admin'], isActive: true }, attributes: ['id', 'email', 'role'], order: [['email', 'ASC']] }) }));
exports.createNote = handle(async (req, res) => {
  const body = text(req.body.body, 'Note');
  const note = await sequelize.transaction(async transaction => {
    await relation(req.body.entityType, req.body.entityId, transaction);
    const record = await Note.create({ entityType: req.body.entityType, entityId: req.body.entityId, authorId: req.user.id, body }, { transaction });
    await audit(req, transaction, 'internal.note_created', req.body.entityType, req.body.entityId, { noteId: record.id });
    return record;
  });
  res.status(201).json({ success: true, data: note });
});
exports.listNotes = handle(async (req, res) => {
  await relation(req.params.entityType, req.params.entityId);
  await paged(Note, req, res, { where: { entityType: req.params.entityType, entityId: req.params.entityId }, include: [person('author')], order: [['createdAt', 'DESC'], ['id', 'ASC']] });
});
exports.deleteNote = handle(async (req, res) => {
  await sequelize.transaction(async transaction => {
    const note = await Note.findByPk(id(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
    if (!note) fail('Note not found', 404);
    if (req.user.role !== 'super_admin' && note.authorId !== req.user.id) fail('You can only delete your own notes', 403);
    await audit(req, transaction, 'internal.note_deleted', note.entityType, note.entityId, { noteId: note.id });
    await note.destroy({ transaction });
  });
  res.json({ success: true });
});
