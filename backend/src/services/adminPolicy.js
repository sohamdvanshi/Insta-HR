const ROLES = ['candidate', 'employer', 'trainer', 'admin', 'super_admin'];
const FLAGS = { training: 'Courses, classes and certificates', ai_screening: 'AI resume and job screening', referrals: 'Referral and loyalty module', bulk_email: 'Employer bulk email campaigns' };
const USER_FIELDS = ['id', 'email', 'phone', 'role', 'isActive', 'isEmailVerified', 'subscriptionPlan', 'subscriptionExpiry', 'referralCode', 'createdAt', 'updatedAt'];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const id = value => { if (!uuid(value)) fail('A valid record ID is required'); return value; };
const reason = value => { if (typeof value !== 'string' || value.trim().length < 5 || value.trim().length > 500) fail('Provide a reason between 5 and 500 characters'); return value.trim(); };
const text = (value, label, max = 10000) => { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} is required (maximum ${max} characters)`); return value.trim(); };
const pagination = query => {
  const page = Number(query.page || 1), limit = Number(query.limit || 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('Invalid pagination');
  return { page, limit, offset: (page - 1) * limit };
};
const safeUser = user => Object.fromEntries(USER_FIELDS.map(key => [key, user[key]]));
const parsePlan = (body, planId) => {
  const name = text(body.name, 'Plan name', 100);
  if (!Number.isSafeInteger(body.amountPaise) || body.amountPaise < 0 || body.amountPaise > 100000000 || (planId === 'free' ? body.amountPaise !== 0 : body.amountPaise < 100)) fail('Invalid price in paise');
  if (!Number.isSafeInteger(body.durationDays) || body.durationDays < 1 || body.durationDays > 365) fail('Duration must be 1–365 days');
  if (!Array.isArray(body.features) || body.features.length > 30 || body.features.some(item => typeof item !== 'string' || !item.trim() || item.length > 200)) fail('Provide up to 30 nonempty perks (200 characters each)');
  if (typeof body.isActive !== 'boolean') fail('Plan active status must be a boolean');
  const extra = {};
  if (body.yearlyAmountPaise !== undefined) {
    if (!Number.isSafeInteger(body.yearlyAmountPaise) || body.yearlyAmountPaise < (planId === 'free' ? 0 : 100) || body.yearlyAmountPaise > 100000000 || (planId === 'free' && body.yearlyAmountPaise !== 0)) fail('Invalid yearly price in paise');
    extra.yearlyAmountPaise = body.yearlyAmountPaise;
  }
  if (body.loyaltyPoints !== undefined) {
    if (!Number.isSafeInteger(body.loyaltyPoints) || body.loyaltyPoints < 0 || body.loyaltyPoints > 100000000 || (planId === 'free' && body.loyaltyPoints !== 0)) fail('Invalid loyalty redemption cost');
    extra.loyaltyPoints = body.loyaltyPoints;
  }
  if (body.featuredJobs !== undefined) {
    if (typeof body.featuredJobs !== 'boolean') fail('Featured jobs must be a boolean');
    extra.featuredJobs = body.featuredJobs;
  }
  return { ...extra, name, amountPaise: body.amountPaise, currency: 'INR', durationDays: body.durationDays, features: body.features.map(item => item.trim()), isActive: body.isActive };
};
module.exports = { ROLES, FLAGS, USER_FIELDS, fail, uuid, id, reason, text, pagination, safeUser, parsePlan };
