const { Op } = require('sequelize')
const { BulkEmailCampaign, Job, Application, User, LoyaltyPointTransaction } = require('../models')
const { sendBulkCampaignEmail } = require('../services/email/emailService')
const { staff, fail, render, escapeHtml } = require('../utils/phase2')
const statuses = ['applied', 'shortlisted', 'hired', 'rejected']
const templates = {
  referral_status: { subject: 'Referral update: {{jobTitle}}', message: 'Hello {{name}}, your {{referralCount}} referral application(s) for {{jobTitle}} currently have status {{referralStatus}}. Your loyalty balance is {{points}} points. Credited points are not a cash payout.' },
  loyalty_balance: { subject: 'Your Insta-HR loyalty balance', message: 'Hello {{name}}, your current balance is {{points}} points. Referral code: {{referralCode}}. View your referral and redemption history in your account.' }
}
const wrap = fn => async (req, res) => {
  try { return await fn(req, res) } catch (e) { console.error('Campaign request failed:', e); return res.status(e.statusCode || 500).json({ success: false, message: e.statusCode ? e.message : 'Campaign request failed' }) }
}
const jobFor = async (req, id) => {
  const job = await Job.findByPk(id)
  if (!job) throw fail('Job not found', 404)
  if (!staff(req.user) && String(job.employerId) !== String(req.user.id)) throw fail('Not authorized', 403)
  return job
}
const selection = (status = 'shortlisted', audience = 'applicants') => {
  if (!statuses.includes(status) || !['applicants', 'referrers'].includes(audience)) throw fail('Invalid campaign audience or status')
  return { status, audience }
}
const recipients = async (jobId, status, audience) => {
  const apps = await Application.findAll({ attributes: ['candidateId', 'referredByUserId'], where: { jobId, status, ...(audience === 'referrers' ? { referredByUserId: { [Op.ne]: null } } : {}) } })
  const counts = new Map()
  for (const app of apps) { const id = audience === 'referrers' ? app.referredByUserId : app.candidateId; if (id) counts.set(String(id), (counts.get(String(id)) || 0) + 1) }
  if (counts.size > 500) throw fail('Campaign exceeds 500 recipients; narrow the selection')
  const users = await User.findAll({ where: { id: [...counts.keys()], isActive: true, isEmailVerified: true }, attributes: ['id', 'email', 'referralCode'] })
  return users.map(u => ({ id: u.id, email: u.email, name: u.email.split('@')[0], referralCode: u.referralCode || '', referralCount: counts.get(String(u.id)) }))
}
exports.getTemplates = wrap(async (req, res) => res.json({ success: true, data: templates }))
exports.createCampaign = wrap(async (req, res) => {
  const job = await jobFor(req, req.body.jobId)
  const { status, audience } = selection(req.body.recipientStatus, req.body.audience)
  const template = req.body.template ? templates[req.body.template] : null
  if (req.body.template && !template) throw fail('Unknown template')
  const subject = String(req.body.subject || template?.subject || '').trim()
  const message = String(req.body.message || template?.message || '').trim()
  if (!subject || subject.length > 255 || /[\r\n]/.test(subject) || !message || message.length > 10000) throw fail('Invalid subject or message')
  const values = { name: '', points: 0, referralCode: '', referralCount: 0, referralStatus: status, jobTitle: job.title, companyName: job.companyName || '' }
  render(subject, values); render(message, values)
  const users = await recipients(job.id, status, audience)
  const data = await BulkEmailCampaign.create({ employerId: job.employerId, jobId: job.id, subject, message, audience, recipientStatus: status, recipientCount: users.length, status: 'draft', sentCount: 0, failedCount: 0 })
  return res.status(201).json({ success: true, data })
})
exports.getMyCampaigns = wrap(async (req, res) => {
  const data = await BulkEmailCampaign.findAll({ where: staff(req.user) ? {} : { employerId: req.user.id }, include: [{ model: Job, as: 'job', attributes: ['id', 'title', 'companyName'] }], order: [['createdAt', 'DESC']], limit: 100 })
  return res.json({ success: true, data })
})
const recipientList = forcedStatus => wrap(async (req, res) => {
  const job = await jobFor(req, req.params.jobId)
  const { status, audience } = selection(forcedStatus || req.query.status, req.query.audience)
  const data = await recipients(job.id, status, audience)
  return res.json({ success: true, count: data.length, data: data.map(({ referralCode, ...x }) => x) })
})
exports.getCandidatesForJobByStatus = recipientList()
exports.getShortlistedCandidatesForJob = recipientList('shortlisted')
exports.sendCampaign = wrap(async (req, res) => {
  const campaign = await BulkEmailCampaign.findByPk(req.params.id)
  if (!campaign) throw fail('Campaign not found', 404)
  const job = await jobFor(req, campaign.jobId)
  const users = await recipients(job.id, campaign.recipientStatus, campaign.audience)
  if (!users.length) throw fail('No eligible recipients')
  const [claimed] = await BulkEmailCampaign.update({ status: 'sending', recipientCount: users.length }, { where: { id: campaign.id, status: 'draft' } })
  if (!claimed) throw fail('Campaign already sent, sending, or failed; create a new draft to retry', 409)
  let sentCount = 0, failedCount = 0
  for (const user of users) {
    try {
      const points = Number(await LoyaltyPointTransaction.sum('points', { where: { userId: user.id } }) || 0)
      const values = { ...user, points, referralStatus: campaign.recipientStatus, jobTitle: job.title, companyName: job.companyName || 'InstaHire Employer' }
      await sendBulkCampaignEmail({ to: user.email, candidateName: user.name, subject: render(campaign.subject, values), message: escapeHtml(render(campaign.message, values)), jobTitle: job.title, companyName: values.companyName })
      sentCount++
    } catch (e) { failedCount++; console.error('Campaign recipient failed:', campaign.id, user.id, e.message) }
    await campaign.update({ sentCount, failedCount })
  }
  await campaign.update({ sentCount, failedCount, status: failedCount ? 'failed' : 'sent', sentAt: new Date() })
  return res.json({ success: true, data: { recipientCount: users.length, sentCount, failedCount, status: failedCount ? 'failed' : 'sent' } })
})
