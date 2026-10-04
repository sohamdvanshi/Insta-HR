const catalog = require('../../../shared/resumeCatalog.json');
const PREMIUM_PLANS = ['premium', 'enterprise'];
const sectors = new Map(catalog.sectors.map(sector => [sector.id, sector]));
const templates = new Set(['classic', 'modern', ...catalog.sectors.map(sector => sector.template)]);
const hasResumePremium = (user, now = new Date()) => PREMIUM_PLANS.includes(user.subscriptionPlan) && new Date(user.subscriptionExpiry) > now;
const getEntitlement = (user, count) => ({
  count, limit: hasResumePremium(user) ? null : 1,
  isPremium: hasResumePremium(user), canCreate: hasResumePremium(user) || count < 1
});
const profileDefaults = (user, profile = {}) => ({
  personalInfo: {
    fullName: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    email: user.email || '', phone: user.phone || '', location: profile.currentLocation || '',
    jobTitle: profile.headline || '', linkedin: '', github: '', website: ''
  },
  summary: profile.summary || '',
  skills: Array.isArray(profile.skills) ? profile.skills : [],
  experience: (Array.isArray(profile.experience) ? profile.experience : []).map(item => ({
    jobTitle: String(item.jobTitle || item.title || ''), company: String(item.company || ''),
    location: String(item.location || ''), startDate: String(item.startDate || ''), endDate: String(item.endDate || ''),
    currentlyWorking: Boolean(item.currentlyWorking), description: String(item.description || ''),
    bullets: Array.isArray(item.bullets) ? item.bullets.filter(value => typeof value === 'string') : []
  })),
  education: (Array.isArray(profile.education) ? profile.education : []).map(item => Object.fromEntries(['institution', 'degree', 'fieldOfStudy', 'startDate', 'endDate', 'description'].map(key => [key, String(item[key] || '')])))
});
const validateResume = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid resume';
  if (body.sector !== undefined && !sectors.has(body.sector)) return 'Invalid sector';
  if (body.template !== undefined && !templates.has(body.template)) return 'Invalid template';
  if (body.visibility !== undefined && !['private', 'link'].includes(body.visibility)) return 'Invalid visibility';
  if (body.status !== undefined && !['draft', 'published'].includes(body.status)) return 'Invalid status';
  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') return 'isDefault must be a boolean';
  for (const key of ['title', 'summary', 'targetJobTitle', 'targetJobDescription']) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > 20000)) return `Invalid ${key}`;
  }
  if (body.personalInfo !== undefined && (!body.personalInfo || typeof body.personalInfo !== 'object' || Array.isArray(body.personalInfo) || Object.values(body.personalInfo).some(value => typeof value !== 'string'))) return 'Invalid personal information';
  for (const key of ['skills', 'certifications', 'languages']) {
    if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].length > 100 || body[key].some(item => typeof item !== 'string'))) return `Invalid ${key}`;
  }
  for (const key of ['experience', 'education', 'projects']) {
    if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].length > 100 || body[key].some(item => !item || typeof item !== 'object' || Array.isArray(item) || Object.entries(item).some(([field, value]) => field === 'bullets' ? !Array.isArray(value) || value.some(bullet => typeof bullet !== 'string') : !['string', 'boolean'].includes(typeof value))))) return `Invalid ${key}`;
  }
  return null;
};
module.exports = { catalog, sectors, templates, hasResumePremium, getEntitlement, profileDefaults, validateResume };
