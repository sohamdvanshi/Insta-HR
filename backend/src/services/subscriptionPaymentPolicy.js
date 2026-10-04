const crypto = require('crypto');
const PLANS = {
  standard: { name: 'Standard Plan', amount: 199900, currency: 'INR', duration: 30 },
  premium: { name: 'Premium Plan', amount: 399900, currency: 'INR', duration: 30 },
  enterprise: { name: 'Enterprise Plan', amount: 999900, currency: 'INR', duration: 30 }
};
const canBuyPlan = (user, plan) => !!PLANS[plan] && (user.role === 'employer' || (user.role === 'candidate' && ['premium', 'enterprise'].includes(plan)));
const validSignature = ({ orderId, paymentId, signature, secret }) => {
  if (![orderId, paymentId, signature, secret].every(value => typeof value === 'string' && value)) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
};
const validateGatewayPayment = ({ user, order, payment, requestedPlan }) => {
  const plan = order.notes?.plan;
  const details = PLANS[plan];
  if (!details || !canBuyPlan(user, plan) || String(order.notes?.userId) !== String(user.id) || (requestedPlan && requestedPlan !== plan)) return null;
  if (payment.order_id !== order.id || payment.status !== 'captured' || Number(order.amount) !== details.amount || Number(payment.amount) !== details.amount || order.currency !== details.currency || payment.currency !== details.currency) return null;
  return { plan, details };
};
module.exports = { PLANS, canBuyPlan, validSignature, validateGatewayPayment };
