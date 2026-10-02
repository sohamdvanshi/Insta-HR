const router = require('express').Router()
const { DataTypes, Op } = require('sequelize')
const { sequelize, User, LoyaltyPointTransaction } = require('../models')
const { authorize } = require('../middleware/auth')
const { fail, positiveInt, encrypt, decrypt } = require('../utils/phase2')
const Profile = sequelize.define('PayoutProfile', {
  userId: { type: DataTypes.UUID, primaryKey: true },
  encryptedBank: { type: DataTypes.TEXT, allowNull: false },
  bankLast4: { type: DataTypes.STRING(4), allowNull: false },
  aadhaarLast4: { type: DataTypes.STRING(4), allowNull: false },
  consentAt: { type: DataTypes.DATE, allowNull: false },
  revision: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
  reviewStatus: { type: DataTypes.STRING(30), defaultValue: 'pending', allowNull: false },
  reviewedBy: { type: DataTypes.UUID }, reviewedAt: { type: DataTypes.DATE },
  bankEvidenceRef: { type: DataTypes.STRING(200) }, identityEvidenceRef: { type: DataTypes.STRING(200) }
}, { tableName: 'payout_profiles', timestamps: true })
const Request = sequelize.define('LoyaltyRedemption', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false },
  idempotencyKey: { type: DataTypes.UUID, allowNull: false },
  points: { type: DataTypes.INTEGER, allowNull: false },
  amountPaise: { type: DataTypes.BIGINT, allowNull: false },
  bankSnapshot: { type: DataTypes.TEXT, allowNull: false },
  profileRevision: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending', allowNull: false },
  transferReference: { type: DataTypes.STRING(120), unique: true },
  reviewedBy: { type: DataTypes.UUID }, reviewedAt: { type: DataTypes.DATE },
  reason: { type: DataTypes.STRING(255) }
}, { tableName: 'loyalty_redemptions', timestamps: true, indexes: [{ unique: true, fields: ['userId', 'idempotencyKey'] }] })
const Audit = sequelize.define('PayoutAudit', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  actorId: { type: DataTypes.UUID, allowNull: false }, userId: { type: DataTypes.UUID, allowNull: false },
  action: { type: DataTypes.STRING(40), allowNull: false }, metadata: { type: DataTypes.JSON, allowNull: false }
}, { tableName: 'payout_audits', timestamps: true })
const safeProfile = p => p ? { userId: p.userId, bankLast4: p.bankLast4, aadhaarLast4: p.aadhaarLast4, reviewStatus: p.reviewStatus, revision: p.revision, reviewedAt: p.reviewedAt, consentAt: p.consentAt } : null
const safeRequest = r => { const { bankSnapshot, ...x } = r.toJSON(); return x }
const audit = (req, userId, action, metadata, transaction) => Audit.create({ actorId: req.user.id, userId, action, metadata }, { transaction })
const policy = () => ({ valuePaise: process.env.LOYALTY_POINT_VALUE_PAISE ? positiveInt(process.env.LOYALTY_POINT_VALUE_PAISE, 100000) : null, minPoints: positiveInt(process.env.LOYALTY_REDEMPTION_MIN_POINTS || 100) })
const balance = (id, transaction) => LoyaltyPointTransaction.sum('points', { where: { userId: id }, transaction }).then(x => Number(x || 0))
const lockUser = async (id, transaction) => {
  const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
  if (!user || user.role !== 'candidate' || !user.isActive || !user.isEmailVerified) throw fail('An active, email-verified candidate account is required', 403)
  return user
}
const wrap = fn => async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try { return await fn(req, res) } catch (e) { console.error('Payout request failed:', e.name); return res.status(e.statusCode || 500).json({ success: false, message: e.statusCode ? e.message : 'Payout request failed' }) }
}
const evidence = value => { const s = String(value || '').trim(); if (!s || s.length > 200 || /\b\d{12}\b/.test(s)) throw fail('Use an opaque evidence reference, not an Aadhaar number'); return s }
router.get('/profile', authorize('candidate'), wrap(async (req, res) => {
  const p = await Profile.findByPk(req.user.id)
  const points = await balance(req.user.id)
  const rules = policy()
  return res.json({ success: true, data: safeProfile(p), balance: points, policy: rules, eligible: Boolean(rules.valuePaise && p?.reviewStatus === 'manual_approved' && points >= rules.minPoints), verificationNotice: 'Manual document review only; this is not UIDAI or electronic Aadhaar verification.' })
}))
router.put('/profile', authorize('candidate'), wrap(async (req, res) => {
  const b = req.body
  if (b.aadhaarNumber !== undefined || b.aadhaar !== undefined) throw fail('Do not submit a full Aadhaar number')
  const accountNumber = String(b.accountNumber || '').trim()
  const ifsc = String(b.ifsc || '').trim().toUpperCase()
  const accountHolder = String(b.accountHolder || '').trim()
  const bankName = String(b.bankName || '').trim()
  const aadhaarLast4 = String(b.aadhaarLast4 || '')
  if (!/^\d{9,18}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) || !accountHolder || accountHolder.length > 150 || !bankName || bankName.length > 150 || !/^\d{4}$/.test(aadhaarLast4) || b.consent !== true) throw fail('Valid bank details, last four Aadhaar digits and explicit consent are required')
  const encryptedBank = encrypt({ accountNumber, ifsc, accountHolder, bankName }, req.user.id)
  const data = await sequelize.transaction(async t => {
    await lockUser(req.user.id, t)
    if (await Request.count({ where: { userId: req.user.id, status: { [Op.in]: ['pending', 'approved'] } }, transaction: t })) throw fail('Bank details are locked while a redemption is open', 409)
    const old = await Profile.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE })
    const values = { encryptedBank, bankLast4: accountNumber.slice(-4), aadhaarLast4, consentAt: new Date(), revision: (old?.revision || 0) + 1, reviewStatus: 'pending', reviewedBy: null, reviewedAt: null, bankEvidenceRef: null, identityEvidenceRef: null }
    const p = old ? await old.update(values, { transaction: t }) : await Profile.create({ userId: req.user.id, ...values }, { transaction: t })
    await audit(req, req.user.id, 'BANK_PROFILE_SUBMITTED', { revision: p.revision }, t)
    return safeProfile(p)
  })
  return res.json({ success: true, data })
}))
router.get('/requests', authorize('candidate'), wrap(async (req, res) => res.json({ success: true, data: (await Request.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']], limit: 100 })).map(safeRequest) })))
router.post('/requests', authorize('candidate'), wrap(async (req, res) => {
  const points = positiveInt(req.body.points)
  const idempotencyKey = String(req.body.idempotencyKey || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) throw fail('A UUID v4 idempotencyKey is required')
  const data = await sequelize.transaction(async t => {
    await lockUser(req.user.id, t)
    const existing = await Request.findOne({ where: { userId: req.user.id, idempotencyKey }, transaction: t })
    if (existing) { if (existing.points !== points) throw fail('Idempotency key used for different points', 409); return safeRequest(existing) }
    const rules = policy()
    if (!rules.valuePaise) throw fail('Cash redemption policy is not configured', 503)
    if (points < rules.minPoints) throw fail(`Minimum redemption is ${rules.minPoints} points`)
    const profile = await Profile.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE })
    if (profile?.reviewStatus !== 'manual_approved') throw fail('Bank and identity review must be approved first')
    if (await balance(req.user.id, t) < points) throw fail('Insufficient loyalty points')
    const amountPaise = points * rules.valuePaise
    if (!Number.isSafeInteger(amountPaise)) throw fail('Amount exceeds supported range')
    const request = await Request.create({ userId: req.user.id, idempotencyKey, points, amountPaise, bankSnapshot: profile.encryptedBank, profileRevision: profile.revision }, { transaction: t })
    await LoyaltyPointTransaction.create({ userId: req.user.id, points: -points, type: 'redeemed', reason: `Reserved for redemption ${request.id}`, createdBy: req.user.id }, { transaction: t })
    await audit(req, req.user.id, 'REDEMPTION_REQUESTED', { requestId: request.id, points, amountPaise }, t)
    return safeRequest(request)
  })
  return res.status(201).json({ success: true, data })
}))
router.get('/admin/profiles', authorize('admin', 'super_admin'), wrap(async (req, res) => res.json({ success: true, data: (await Profile.findAll({ order: [['updatedAt', 'DESC']], limit: 200 })).map(safeProfile) })))
router.get('/admin/requests', authorize('admin', 'super_admin'), wrap(async (req, res) => res.json({ success: true, data: (await Request.findAll({ order: [['createdAt', 'DESC']], limit: 200 })).map(safeRequest) })))
router.get('/admin/profiles/:userId/bank', authorize('admin', 'super_admin'), wrap(async (req, res) => {
  const p = await Profile.findByPk(req.params.userId)
  if (!p) throw fail('Profile not found', 404)
  const data = decrypt(p.encryptedBank, p.userId)
  await audit(req, p.userId, 'BANK_DETAILS_ACCESSED', { revision: p.revision })
  return res.json({ success: true, data, revision: p.revision })
}))
router.patch('/admin/profiles/:userId/review', authorize('admin', 'super_admin'), wrap(async (req, res) => {
  const { decision } = req.body
  if (!['manual_approved', 'rejected'].includes(decision)) throw fail('Invalid review decision')
  const bankEvidenceRef = decision === 'manual_approved' ? evidence(req.body.bankEvidenceRef) : null
  const identityEvidenceRef = decision === 'manual_approved' ? evidence(req.body.identityEvidenceRef) : null
  const data = await sequelize.transaction(async t => {
    await lockUser(req.params.userId, t)
    const p = await Profile.findByPk(req.params.userId, { transaction: t, lock: t.LOCK.UPDATE })
    if (!p) throw fail('Profile not found', 404)
    if (p.revision !== Number(req.body.revision)) throw fail('Profile changed; refresh before reviewing', 409)
    if (p.reviewStatus !== 'pending') throw fail('Profile already reviewed', 409)
    await p.update({ reviewStatus: decision, bankEvidenceRef, identityEvidenceRef, reviewedBy: req.user.id, reviewedAt: new Date() }, { transaction: t })
    await audit(req, p.userId, 'PROFILE_MANUAL_REVIEW', { decision, revision: p.revision, bankEvidenceRef, identityEvidenceRef }, t)
    return safeProfile(p)
  })
  return res.json({ success: true, data })
}))
router.get('/admin/requests/:id/bank', authorize('admin', 'super_admin'), wrap(async (req, res) => {
  const r = await Request.findByPk(req.params.id)
  if (!r) throw fail('Redemption not found', 404)
  const data = decrypt(r.bankSnapshot, r.userId)
  await audit(req, r.userId, 'REDEMPTION_BANK_ACCESSED', { requestId: r.id })
  return res.json({ success: true, data })
}))
router.patch('/admin/requests/:id', authorize('admin', 'super_admin'), wrap(async (req, res) => {
  const initial = await Request.findByPk(req.params.id)
  if (!initial) throw fail('Redemption not found', 404)
  const { status } = req.body
  const reason = String(req.body.reason || '').trim()
  if (!['approved', 'rejected', 'paid'].includes(status) || !reason || reason.length > 255) throw fail('Valid status and a reason are required')
  const data = await sequelize.transaction(async t => {
    const user = await User.findByPk(initial.userId, { transaction: t, lock: t.LOCK.UPDATE })
    if (!user) throw fail('Candidate not found', 404)
    const r = await Request.findByPk(initial.id, { transaction: t, lock: t.LOCK.UPDATE })
    if (!r || ['paid', 'rejected'].includes(r.status)) throw fail('Redemption is already finalized', 409)
    if (status === 'approved' && r.status !== 'pending') throw fail('Only pending requests can be approved', 409)
    if (status === 'paid' && r.status !== 'approved') throw fail('Approve the request before recording a transfer', 409)
    const transferReference = status === 'paid' ? String(req.body.transferReference || '').trim() : null
    if (status === 'paid' && (!transferReference || transferReference.length > 120)) throw fail('An actual bank-transfer reference is required; this endpoint does not transfer money')
    if (status !== 'rejected' && (!user.isActive || !user.isEmailVerified)) throw fail('Candidate account is not eligible', 403)
    if (status === 'rejected') await LoyaltyPointTransaction.create({ userId: r.userId, points: r.points, type: 'adjusted', reason: `Refund for rejected redemption ${r.id}`, createdBy: req.user.id }, { transaction: t })
    await r.update({ status, reason, transferReference, reviewedBy: req.user.id, reviewedAt: new Date() }, { transaction: t })
    await audit(req, r.userId, 'REDEMPTION_STATUS_CHANGED', { requestId: r.id, status, reason, transferReference }, t)
    return safeRequest(r)
  })
  return res.json({ success: true, data })
}))
module.exports = router
