const crypto = require('crypto');
const WageRegister = require('../models/WageRegister');
const AuditLog = require('../models/AuditLog');
const sequelize = require('../config/database');
const { parse } = require('../services/attendanceWorkbook');
const { normalizeRows } = require('../services/wageCalculation');
const { exported } = require('../services/wageExport');
const uuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v));
const fail = (message, status=400) => Object.assign(new Error(message), { status });
function metadata(body) {
  const period = String(body.period || ''); const site = String(body.site || '').trim();
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw fail('Choose a valid payroll month');
  if (!site || site.length > 100) throw fail('Site / establishment is required (maximum 100 characters)');
  return { period, site };
}
function scope(req) { return req.user.role === 'employer' ? { employerId: req.user.id } : {}; }
async function record(req, transaction) {
  if (!uuid(req.params.id)) throw fail('Invalid register ID');
  const r = await WageRegister.findOne({ where: { id: req.params.id, ...scope(req) }, transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!r) throw fail('Register not found',404); return r;
}
async function audit(req, r, action, metadata, transaction) {
  try {
    await AuditLog.create({ actorId: req.user.id, actorRole: req.user.role, action, entityType: 'wage_register', entityId: r.id, targetUserId: r.employerId, metadata, status: 'success' }, { transaction });
  } catch { throw fail('Audit recording failed; no changes were saved.',500); }
}
const run = fn => async (req,res) => { try { await fn(req,res); } catch(e) {
  if (e.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ message: 'A register already exists for this employer, month and site. Open it instead of importing again.' });
  if (e.status || !e.name.startsWith('Sequelize')) return res.status(e.status || 400).json({ message: e.message });
  console.error(
  'Wage register operation failed',
  e.name,
  e.parent?.code,
  e.parent?.message || e.message
);
} };
exports.preview = run(async (req,res) => {
  const { period } = metadata(req.body); if (!req.file) throw fail('Select an attendance .xlsx file');
  res.json({ data: await parse(req.file.buffer, period) });
});
exports.create = run(async (req,res) => {
  const meta = metadata(req.body); if (!req.file) throw fail('Select an attendance .xlsx file');
  const parsed = await parse(req.file.buffer,meta.period);
  const r = await sequelize.transaction(async transaction => {
    const r = await WageRegister.create({ ...meta, employerId: req.user.id, rows: parsed.rows, warnings: parsed.warnings,
      sourceName: req.file.originalname.slice(0,255), sourceHash: crypto.createHash('sha256').update(req.file.buffer).digest('hex') }, { transaction });
    await audit(req,r,'wage_register.import',{ period: r.period, site: r.site, employeeCount: r.rows.length },transaction); return r;
  }); res.status(201).json({ data: r });
});
exports.list = run(async (req,res) => {
  const page = Math.max(1, Math.min(10000, parseInt(req.query.page) || 1)); const where = scope(req);
  if (req.query.period) { if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(req.query.period)) throw fail('Invalid month'); where.period = req.query.period; }
  if (req.query.employerId && req.user.role === 'super_admin') { if (!uuid(req.query.employerId)) throw fail('Invalid employer ID'); where.employerId = req.query.employerId; }
  const result = await WageRegister.findAndCountAll({ where, attributes: ['id','employerId','period','site','status','version','createdAt','updatedAt'], order: [['createdAt','DESC']], limit: 20, offset: (page-1)*20 });
  res.json({ data: result.rows, pagination: { page, pages: Math.ceil(result.count/20), total: result.count } });
});
exports.get = run(async (req,res) => res.json({ data: await record(req) }));
exports.update = run(async (req,res) => {
  const updated = await sequelize.transaction(async transaction => {
    const r = await record(req,transaction);
    if (r.status !== 'draft') throw fail('Approved registers are locked',409);
    if (req.body.version !== r.version) throw fail('This register changed in another tab. Reload before editing.',409);
    const rows = normalizeRows(req.body.rows);
    // Attendance and identity cannot be rewritten by a wage edit.
    if (rows.length !== r.rows.length || rows.some((row,i) => row.employeeId !== r.rows[i].employeeId || row.name !== r.rows[i].name || row.days.length !== r.rows[i].days.length || row.days.some((day,j) => day.date !== r.rows[i].days[j].date || day.code !== r.rows[i].days[j].code))) throw fail('Imported employee identities and attendance cannot be changed through wage entry');
    const before = r.rows;
    await r.update({ rows, version: r.version + 1 },{ transaction });
    await audit(req,r,'wage_register.update',{ before, after: rows },transaction); return r;
  }); res.json({ data: updated });
});
exports.approve = run(async (req,res) => {
  const r = await sequelize.transaction(async transaction => {
    const r = await record(req,transaction);
    if (r.version !== req.body.version) throw fail('Reload this register before approving',409);
    if (r.status !== 'draft') throw fail('Register is already approved',409);
    const rows = normalizeRows(r.rows);
    if (rows.some(row => row.rate <= 0 || row.net < 0 || row.days.some(d => !d.code))) throw fail('Approval requires positive wage rates, nonnegative net wages and no blank daily attendance codes');
    await r.update({ rows, status: 'approved', version: r.version+1, approvedAt: new Date() },{ transaction });
    await audit(req,r,'wage_register.approve',{ totalNet: rows.reduce((n,row)=>n+row.net,0) },transaction); return r;
  }); res.json({ data: r });
});
exports.export = run(async (req,res) => {
  const r = await record(req); const buffer = await exported(r).xlsx.writeBuffer();
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition',`attachment; filename="wage-register-${r.period}-${r.id}.xlsx"`); res.send(Buffer.from(buffer));
});

exports.replaceAttendance = run(async (req,res) => {
  const meta = metadata(req.body); if (!req.file) throw fail('Select an attendance .xlsx file');
  const parsed = await parse(req.file.buffer, meta.period);
  const result = await sequelize.transaction(async transaction => {
    const r = await record(req,transaction);
    if (r.status !== 'draft') throw fail('Approved registers are locked',409);
    if (Number(req.body.version) !== r.version) throw fail('Reload before replacing attendance',409);
    if (meta.period !== r.period || meta.site !== r.site) throw fail('Month and site must match the open register');
    const previous = new Map(r.rows.map(row => [row.employeeId,row]));
    const rows = normalizeRows(parsed.rows.map(row => ({ ...(previous.get(row.employeeId) || {}), ...row,
      ...Object.fromEntries(require('../services/wageCalculation').INPUTS.map(k => [k,previous.get(row.employeeId)?.[k] || 0])),
      ...Object.fromEntries(['uan','group','transactionId','paymentDate','remarks'].map(k => [k,previous.get(row.employeeId)?.[k] || ''])) })));
    const before = r.rows;
    await r.update({ rows, warnings: parsed.warnings, version: r.version + 1, sourceName: req.file.originalname.slice(0,255), sourceHash: crypto.createHash('sha256').update(req.file.buffer).digest('hex') }, { transaction });
    await audit(req,r,'wage_register.replace_attendance',{ before, after: rows },transaction); return r;
  }); res.json({ data: result });
});
