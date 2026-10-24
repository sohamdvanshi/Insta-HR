const { User, SubscriptionPlan, LoyaltyPointTransaction, sequelize } = require('../models');
const { fail, id } = require('../services/adminPolicy');
const { handle, audit } = require('../services/adminOperations');
const { expiryFor } = require('../services/subscriptionTerms');
exports.options = handle(async (req, res) => {
  const plans = await SubscriptionPlan.findAll({ where: { isActive: true } });
  const balance = Number(await LoyaltyPointTransaction.sum('points', { where: { userId: req.user.id } }) || 0);
  res.json({ success: true, data: { balance, plans: plans.filter(p => p.id !== 'free' && p.loyaltyPoints > 0).map(p => ({ id: p.id, name: p.name, points: p.loyaltyPoints, durationDays: p.durationDays })) } });
});
exports.redeem = handle(async (req, res) => {
  const redemptionKey = id(req.body.requestId);
  if (!['standard', 'premium', 'enterprise'].includes(req.body.plan)) fail('Choose a redemption plan');
  const result = await sequelize.transaction(async transaction => {
    const user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== 'candidate' || !user.isActive) fail('Candidate account is unavailable', 403);
    const previous = await LoyaltyPointTransaction.findOne({ where: { userId: user.id, redemptionKey }, transaction });
    if (previous) {
      if (previous.redemptionDetails?.plan !== req.body.plan) fail('This request was already used for another plan', 409);
      return previous.redemptionDetails;
    }
    const plan = await SubscriptionPlan.findByPk(req.body.plan, { transaction, lock: transaction.LOCK.SHARE });
    if (!plan?.isActive || !Number.isSafeInteger(plan.loyaltyPoints) || plan.loyaltyPoints <= 0) fail('Redemption is unavailable for this plan');
    const balance = Number(await LoyaltyPointTransaction.sum('points', { where: { userId: user.id }, transaction }) || 0);
    if (balance < plan.loyaltyPoints) fail('Not enough loyalty points', 409);
    const expiresAt = expiryFor(user, plan.id, plan.durationDays);
    const details = { plan: plan.id, name: plan.name, points: plan.loyaltyPoints, durationDays: plan.durationDays, expiresAt, balance: balance - plan.loyaltyPoints };
    const entry = await LoyaltyPointTransaction.create({ userId: user.id, points: -plan.loyaltyPoints, type: 'redeemed', reason: `${plan.name}: ${plan.durationDays} days`, createdBy: user.id, redemptionKey, redemptionDetails: details }, { transaction });
    await user.update({ subscriptionPlan: plan.id, subscriptionExpiry: expiresAt, subscriptionReminder7Sent: false, subscriptionReminder1Sent: false, subscriptionExpiredMailSent: false }, { transaction });
    await audit(req, transaction, 'loyalty.subscription_redeemed', 'user', user.id, { ...details, ledgerId: entry.id });
    return details;
  });
  res.json({ success: true, data: result });
});
