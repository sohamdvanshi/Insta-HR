const { CandidateProfile, Resume, Application, User, Job } = require('../models');

const plain = value => value?.toJSON ? value.toJSON() : value || {};
const text = value => typeof value === 'string' ? value.trim() : '';
const array = value => Array.isArray(value) ? value : [];
const skillsOf = value => array(value).map(item => text(typeof item === 'string' ? item : item?.name)).filter(Boolean);
const userInclude = as => ({ model: User, as, attributes: ['id', 'email', 'phone', 'role'], required: true, where: { role: 'candidate', isActive: true } });

// Merge overlapping work periods so concurrent positions do not double-count experience.
function experienceYears(experience, now = Date.now()) {
  const intervals = array(experience).map(item => {
    const start = Date.parse(item?.startDate || item?.from);
    const endDate = item?.endDate || item?.to;
    const end = item?.currentlyWorking || item?.current || !endDate || /present/i.test(endDate) ? now : Date.parse(endDate);
    return [start, Math.min(end, now)];
  }).filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start).sort((a, b) => a[0] - b[0]);
  let total = 0, start, end;
  for (const interval of intervals) {
    if (end === undefined || interval[0] > end) {
      if (end !== undefined) total += end - start;
      [start, end] = interval;
    } else end = Math.max(end, interval[1]);
  }
  if (end !== undefined) total += end - start;
  return Math.round(total / (365.25 * 86400000) * 10) / 10;
}

function profileRow(value) {
  const p = plain(value), user = plain(p.user);
  return {
    id: `profile:${p.id}`, userId: p.userId, firstName: p.firstName || '', lastName: p.lastName || '',
    headline: p.headline || '', summary: p.summary || '', skills: skillsOf(p.skills),
    experience: array(p.experience), education: array(p.education), currentLocation: p.currentLocation || '',
    yearsOfExperience: p.yearsOfExperience == null ? experienceYears(p.experience) : Number(p.yearsOfExperience) || 0,
    industry: p.industry || '', expectedSalary: p.expectedSalary, profileCompleteness: p.profileCompleteness,
    preferredLocations: skillsOf(p.preferredLocations), preferredJobTypes: skillsOf(p.preferredJobTypes),
    updatedAt: p.updatedAt, resumeUrl: p.resumeUrl || null, email: user.email || '', phone: user.phone || '', source: 'profile'
  };
}

function resumeRow(value, publicProfile) {
  const r = plain(value), info = plain(r.personalInfo), user = plain(r.user), base = publicProfile || {};
  const names = text(info.fullName).split(/\s+/);
  return {
    ...base, id: `resume:${r.id}`, userId: r.userId, resumeId: r.id, title: text(r.title),
    firstName: names[0] || base.firstName || '', lastName: names.slice(1).join(' ') || base.lastName || '',
    headline: text(info.jobTitle) || text(r.targetJobTitle) || base.headline || '', summary: text(r.summary) || base.summary || '',
    skills: skillsOf(r.skills), experience: array(r.experience), education: array(r.education),
    yearsOfExperience: array(r.experience).length ? experienceYears(r.experience) : base.yearsOfExperience || 0, currentLocation: text(info.location) || base.currentLocation || '',
    industry: r.sector === 'general' ? base.industry || '' : String(r.sector || '').replace(/_/g, ' '),
    email: user.email || text(info.email) || '', phone: text(info.phone) || user.phone || '', resumeUrl: null, updatedAt: r.updatedAt, source: 'resume'
  };
}

async function publicRows() {
  const [profiles, resumes] = await Promise.all([
    CandidateProfile.findAll({ where: { isResumePublic: true }, include: [userInclude('user')], order: [['updatedAt', 'DESC']] }),
    Resume.findAll({ where: { visibility: 'link' }, include: [userInclude('user')], order: [['updatedAt', 'DESC']] })
  ]);
  const rows = profiles.map(profileRow);
  const byUser = new Map(rows.map(row => [String(row.userId), row]));
  return [...resumes.map(resume => resumeRow(resume, byUser.get(String(resume.userId)))), ...rows];
}

async function applicationRows({ employerId, jobId }) {
  const applications = await Application.findAll({
    ...(jobId ? { where: { jobId } } : {}),
    include: [userInclude('candidate'), { model: Job, as: 'job', required: true, attributes: ['id', 'location', 'jobType'], ...(!jobId ? { where: { employerId } } : {}) }],
    order: [['createdAt', 'DESC']]
  });
  if (!applications.length) return [];
  const profiles = await CandidateProfile.findAll({ where: { userId: [...new Set(applications.map(a => a.candidateId))] } });
  const byUser = new Map(profiles.map(p => [String(p.userId), p]));
  return applications.map(value => {
    const a = plain(value), user = plain(a.candidate), profile = plain(byUser.get(String(a.candidateId)));
    return {
      ...profileRow({ ...profile, user }), id: `application:${a.id}`, userId: a.candidateId,
      firstName: profile.firstName || user.email || '', applicationId: a.id, applicationStatus: a.status,
      resumeUrl: a.resumeUrl || null, resumeText: a.resumeText || '', resumeFilename: a.resumeFilename || '',
      appliedLocation: text(a.job?.location), appliedJobType: text(a.job?.jobType), updatedAt: a.createdAt, source: 'application'
    };
  });
}

const unique = values => [...new Map(values.filter(Boolean).map(value => [String(value).trim().toLowerCase(), String(value).trim()])).values()];
const types = new Set(['full-time', 'part-time', 'internship', 'contract', 'remote']);

// Identity is the user ID, never a resume ID, name or editable email address.
function groupCandidates(rows) {
  const grouped = new Map();
  const priority = row => row.source === 'profile' ? 0 : row.source === 'application' && row.firstName !== row.email ? 1 : row.source === 'resume' ? 2 : 3;
  for (const row of [...rows].sort((a, b) => priority(a) - priority(b))) {
    const id = String(row.userId);
    let candidate = grouped.get(id);
    if (!candidate) {
      candidate = { ...row, id, userId: id, resumes: [], skills: [], education: [], industries: [], locations: [], preferredLocations: [], preferredJobTypes: [], appliedLocations: [], jobTypes: [], applicationStatuses: [], resumeText: '' };
      grouped.set(id, candidate);
    }
    for (const field of ['firstName', 'lastName', 'headline', 'summary', 'currentLocation', 'industry', 'email', 'phone', 'expectedSalary']) {
      if ((candidate[field] == null || candidate[field] === '') && row[field] != null) candidate[field] = row[field];
    }
    if (candidate.firstName === candidate.email && row.firstName !== row.email && row.firstName) candidate.firstName = row.firstName;
    candidate.skills = unique([...candidate.skills, ...row.skills]);
    candidate.education.push(...row.education);
    candidate.industries = unique([...candidate.industries, row.industry]);
    candidate.locations = unique([...candidate.locations, row.currentLocation]);
    candidate.preferredLocations = unique([...candidate.preferredLocations, ...array(row.preferredLocations)]);
    candidate.preferredJobTypes = unique([...candidate.preferredJobTypes, ...array(row.preferredJobTypes)]);
    candidate.appliedLocations = unique([...candidate.appliedLocations, row.appliedLocation]);
    candidate.jobTypes = unique([...candidate.jobTypes, ...array(row.preferredJobTypes), row.appliedJobType]);
    candidate.applicationStatuses = unique([...candidate.applicationStatuses, row.applicationStatus]);
    candidate.yearsOfExperience = Math.max(Number(candidate.yearsOfExperience) || 0, Number(row.yearsOfExperience) || 0);
    if (!candidate.experience.length && row.experience.length) candidate.experience = row.experience;
    if (row.resumeText && !candidate.resumeText.includes(row.resumeText)) candidate.resumeText = [candidate.resumeText, row.resumeText].filter(Boolean).join('\n');
    if (row.applicationId && !candidate.applicationId) { candidate.applicationId = row.applicationId; candidate.applicationStatus = row.applicationStatus; }
    if (row.resumeId || row.resumeUrl) {
      const key = row.resumeId ? `builder:${row.resumeId}` : `upload:${row.resumeUrl}`;
      if (!candidate.resumes.some(resume => resume.id === key)) candidate.resumes.push({ id: key, resumeId: row.resumeId || null, url: row.resumeUrl || null, title: row.title || row.resumeFilename || '', source: row.source });
    }
  }
  return [...grouped.values()];
}

// Other employers' submissions contribute only city/type, for already-visible candidates.
async function addAppliedPreferences(candidates) {
  if (!candidates.length) return candidates;
  const byUser = new Map(candidates.map(c => [String(c.userId), c]));
  const applications = await Application.findAll({ attributes: ['candidateId'], where: { candidateId: [...byUser.keys()] }, include: [{ model: Job, as: 'job', required: true, attributes: ['location', 'jobType'] }] });
  for (const value of applications) {
    const a = plain(value), candidate = byUser.get(String(a.candidateId));
    if (!candidate) continue;
    candidate.appliedLocations = unique([...candidate.appliedLocations, text(a.job?.location)]);
    candidate.jobTypes = unique([...candidate.jobTypes, text(a.job?.jobType)]);
  }
  return candidates;
}
function filterRows(rows, filters = {}) {
  const get = key => text(filters[key]).toLowerCase();
  const keyword = get('keyword'), location = get('location'), industry = get('industry').replace(/_/g, ' '), jobType = get('jobType'), education = get('education');
  const numeric = key => {
    const raw = get(key); if (!raw) return null;
    if (!Number.isFinite(Number(raw)) || Number(raw) < 0) { const error = new Error('Invalid search filters'); error.statusCode = 400; throw error; }
    return Number(raw);
  };
  const min = numeric('minExperience'), max = numeric('maxExperience'), salary = numeric('maxSalary');
  if ((min !== null && max !== null && min > max) || (jobType && !types.has(jobType))) { const error = new Error('Invalid search filters'); error.statusCode = 400; throw error; }
  const required = get('skills').split(',').map(s => s.trim()).filter(Boolean);
  return rows.filter(row => {
    const educationText = row.education.map(item => typeof item === 'string' ? item : Object.values(item || {}).filter(v => typeof v === 'string').join(' ')).join(' ').toLowerCase();
    const locations = [...row.locations, ...row.preferredLocations, ...row.appliedLocations];
    const haystack = [row.firstName, row.lastName, row.email, row.headline, row.summary, row.resumeText, educationText, ...row.industries, ...locations, ...row.skills, ...row.resumes.map(r => r.title)].join(' ').toLowerCase();
    return (!keyword || haystack.includes(keyword)) && (!location || locations.some(city => city.toLowerCase().includes(location))) &&
      (!industry || row.industries.some(value => value.toLowerCase().replace(/_/g, ' ').includes(industry))) &&
      (!jobType || row.jobTypes.includes(jobType)) && (!education || educationText.includes(education)) &&
      (min === null || row.yearsOfExperience >= min) && (max === null || row.yearsOfExperience <= max) &&
      (salary === null || (row.expectedSalary != null && row.expectedSalary !== '' && Number(row.expectedSalary) <= salary)) &&
      (!required.length || required.every(s => row.skills.some(skill => skill.toLowerCase() === s)));
  });
}
async function databank(employerId, filters) {
  const [shared, submitted] = await Promise.all([publicRows(), applicationRows({ employerId })]);
  const candidates = await addAppliedPreferences(groupCandidates([...shared, ...submitted]));
  return filterRows(candidates, filters).map(({ resumeText, resumeId, resumeUrl, title, source, ...candidate }) => candidate);
}
async function matchingCandidates(jobId) {
  const [shared, submitted] = await Promise.all([publicRows(), applicationRows({ jobId })]);
  return groupCandidates([...shared, ...submitted]);
}
module.exports = { databank, matchingCandidates, filterRows, experienceYears, groupCandidates };
