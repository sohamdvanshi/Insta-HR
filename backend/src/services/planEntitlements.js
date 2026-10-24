const { SubscriptionPlan } = require('../models');
async function entitlementsFor(user) {
  const active = user?.subscriptionExpiry && new Date(user.subscriptionExpiry).getTime() > Date.now();
  const plan = await SubscriptionPlan.findByPk(active ? user.subscriptionPlan : 'free');
  // isActive controls sales, not benefits already purchased. Benefit edits take effect immediately.
  return { featuredJobs: Boolean(plan?.featuredJobs) };
}
module.exports = { entitlementsFor };
