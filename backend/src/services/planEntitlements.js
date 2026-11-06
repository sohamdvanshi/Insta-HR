const { SubscriptionPlan } = require('../models');
async function entitlementsFor(user) {
  const active = user?.subscriptionExpiry && new Date(user.subscriptionExpiry).getTime() > Date.now();
  const plan = await SubscriptionPlan.findByPk(active ? user.subscriptionPlan : 'free');
  // isActive controls sales, not benefits already purchased. Benefit edits take effect immediately.
  const attributes = require('./planAttributes');
  return { ...attributes.valuesFor(plan || {}, attributes.SYSTEM), featuredJobs: Boolean(plan?.featuredJobs), resumeLimit: require('./planAttributes').resumeLimitFor(plan) };
}
module.exports = { entitlementsFor };
