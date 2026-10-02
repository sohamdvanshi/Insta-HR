const { Op } = require('sequelize')
const { Application, User, Job, LoyaltyPointTransaction } = require('../models')
const { awardReferralReward, DEFAULT_REFERRAL_REWARD_POINTS } = require('../services/referralReward.service')
const { staff, fail, positiveInt } = require('../utils/phase2')
const { writeAuditLog } = require('../utils/auditLogger')
const statuses = ['applied', 'shortlisted', 'interview', 'rejected', 'hired']
const includes = [{ model: User, as: 'candidate', attributes: ['id', 'email'], required: false }, { model: User, as: 'referrer', attributes: ['id', 'email', 'referralCode'], required: false }, { model: Job, as: 'job', attributes: ['id', 'title', 'employerId'], required: false }]
const attributes = ['id', 'jobId', 'candidateId', 'referredByUserId', 'referralCodeUsed', 'status', 'referralRewarded', 'referralRewardedAt', 'referralRewardPoints', 'createdAt']
const format = app => {
  const x = app.toJSON()
  return { ...x, applicationStatus: x.status, referralCode: x.referralCodeUsed, rewardPoints: Number(x.referralRewardPoints || 0), rewardedAt: x.referralRewardedAt, referralStatus: x.referralRewarded ? 'rewarded' : x.status, rewardStatus: x.referralRewarded ? 'credited' : x.status === 'hired' ? 'eligible' : x.status === 'rejected' ? 'not_eligible' : 'pending' }
}
const handle = fn => async (req, res) => {
  try { return await fn(req, res) } catch (e) { console.error('Referral request failed:', e); return res.status(e.statusCode || 500).json({ success: false, message: e.statusCode ? e.message : 'Referral request failed' }) }
}
exports.getMyReferralCode = handle(async (req, res) => {
  if (req.user.role !== 'candidate') throw fail('Candidates only', 403)
  const user = await User.findByPk(req.user.id, { attributes: ['referralCode'] })
  return res.json({ success: true, data: { referralCode: user?.referralCode || null } })
})
exports.getMyLoyaltyPoints = handle(async (req, res) => {
  if (req.user.role !== 'candidate') throw fail('Candidates only', 403)
  const transactions = await LoyaltyPointTransaction.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] })
  return res.json({ success: true, balance: transactions.reduce((s, x) => s + Number(x.points), 0), transactions })
})
const list = (mode) => handle(async (req, res) => {
  if (mode === 'admin' && !staff(req.user)) throw fail('Admins only', 403)
  if (mode === 'employer' && !staff(req.user) && req.user.role !== 'employer') throw fail('Not authorized', 403)
  if (mode === 'mine' && req.user.role !== 'candidate') throw fail('Candidates only', 403)
  if (req.query.status && !statuses.includes(req.query.status)) throw fail('Invalid application status')
  const where = { referredByUserId: mode === 'mine' ? req.user.id : { [Op.ne]: null } }
  if (req.query.status) where.status = req.query.status
  const include = includes.map(x => ({ ...x }))
  if (req.user.role === 'employer') Object.assign(include[2], { required: true, where: { employerId: req.user.id } })
  const page = positiveInt(req.query.page || 1)
  const limit = positiveInt(req.query.limit || 50, 200)
  const result = await Application.findAndCountAll({ attributes, where, include, distinct: true, order: [['createdAt', 'DESC']], offset: (page - 1) * limit, limit })
  return res.json({ success: true, count: result.count, pagination: { page, limit, total: result.count }, data: result.rows.map(format) })
})
exports.getMyReferrals = list('mine')
exports.getEmployerReferrals = list('employer')
exports.getAdminReferrals = list('admin')
exports.awardReferralPoints = handle(async (req, res) => {
  if (!staff(req.user)) throw fail('Admins only', 403)
  const points = req.body.points === undefined ? DEFAULT_REFERRAL_REWARD_POINTS : positiveInt(req.body.points)
  const reason = String(req.body.reason || '').trim()
  if (!reason || reason.length > 255) throw fail('A reason of 1-255 characters is required')
  const result = await awardReferralReward({ applicationId: req.params.applicationId, points, reason, createdBy: req.user.id })
  if (result.alreadyRewarded) throw fail('Referral points already credited', 409)
  if (!result.rewarded) throw fail(result.reason || 'Referral not eligible')
  try { await writeAuditLog({ req, action: 'REFERRAL_MANUAL_REWARD', entityType: 'Application', entityId: req.params.applicationId, targetUserId: result.application?.referredByUserId, metadata: { points, reason, transactionId: result.transaction?.id } }) } catch (e) { console.error('Reward audit failed:', e.message) }
  return res.status(201).json({ success: true, message: 'Referral points credited', data: { points, transactionId: result.transaction?.id } })
})
exports.getReferralById = handle(async (req, res) => {
  const app = await Application.findByPk(req.params.id, { attributes, include: includes })
  if (!app || !app.referredByUserId) throw fail('Referral not found', 404)
  const allowed = staff(req.user) || String(app.candidateId) === String(req.user.id) || String(app.referredByUserId) === String(req.user.id) || (req.user.role === 'employer' && String(app.job?.employerId) === String(req.user.id))
  if (!allowed) throw fail('Not authorized', 403)
  return res.json({ success: true, data: format(app) })
})
exports.createReferral = (req, res) => res.status(410).json({ success: false, message: 'Use a referral code when applying' })
exports.updateReferralStatus = (req, res) => res.status(410).json({ success: false, message: 'Referral status follows application status' })
