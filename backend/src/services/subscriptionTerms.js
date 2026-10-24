const { fail } = require('./adminPolicy');
const DAY = 86400000;
function purchaseTerms(plan, cycle = 'monthly') {
  if (!['monthly', 'yearly'].includes(cycle)) fail('Choose monthly or yearly billing');
  const amountPaise = cycle === 'yearly' ? plan.yearlyAmountPaise : plan.amountPaise;
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100 || amountPaise > 100000000) fail('This billing option is unavailable');
  return { amountPaise, durationDays: cycle === 'yearly' ? 365 : plan.durationDays, billingCycle: cycle };
}
function expiryFor(user, plan, days, now = Date.now()) {
  const current = new Date(user.subscriptionExpiry || 0).getTime();
  // Do not silently discard a paid balance by changing plans mid-term.
  if (current > now && user.subscriptionPlan !== 'free' && user.subscriptionPlan !== plan) fail('An active subscription already exists. Renew the same plan or change plans after it expires.', 409);
  return new Date(Math.max(now, Number.isFinite(current) && user.subscriptionPlan === plan ? current : 0) + days * DAY);
}
module.exports = { purchaseTerms, expiryFor };
