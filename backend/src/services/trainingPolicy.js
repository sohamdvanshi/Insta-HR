const STAFF_ROLES = ['admin', 'super_admin', 'trainer', 'employer'];
const isAdmin = user => ['admin', 'super_admin'].includes(user?.role);
const ownsCourse = (user, course) => isAdmin(user) || (STAFF_ROLES.includes(user?.role) && course?.providerId === user.id);
const publicCourse = course => {
  const data = typeof course.toJSON === 'function' ? course.toJSON() : { ...course };
  for (const key of ['videoUrl', 'videoPublicId', 'thumbnailPublicId', 'liveLink', 'liveSchedule']) delete data[key];
  data.hasVideo = !!course.videoUrl;
  return data;
};
const httpUrl = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};
const parseCourse = (body, creating = false) => {
  const data = {};
  for (const key of ['title', 'description', 'category', 'duration', 'emoji']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || body[key].length > 20000) throw new Error(`Invalid ${key}`);
      data[key] = body[key].trim();
    }
  }
  if ((creating || body.title !== undefined) && !data.title) throw new Error('Course title is required');
  if ((creating || body.description !== undefined) && !data.description) throw new Error('Course description is required');
  if (body.type && body.type !== 'video') throw new Error('Schedule live classes in Sessions, separately from courses');
  if (body.liveLink || body.liveSchedule) throw new Error('Schedule classes in Sessions');
  if (body.isFree !== undefined) {
    if (![true, false, 'true', 'false'].includes(body.isFree)) throw new Error('Invalid free course setting');
    data.isFree = body.isFree === true || body.isFree === 'true';
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 1000000) throw new Error('Invalid course price');
    data.price = price;
  }
  if (data.isFree) data.price = 0;
  if (body.status !== undefined) {
    if (!['active', 'inactive'].includes(body.status)) throw new Error('Invalid course status');
    data.status = body.status;
  }
  if (body.skills !== undefined) {
    data.skills = typeof body.skills === 'string' ? body.skills.split(',').map(x => x.trim()).filter(Boolean) : body.skills;
    if (!Array.isArray(data.skills) || data.skills.length > 100 || data.skills.some(x => typeof x !== 'string')) throw new Error('Invalid skills');
  }
  if (body.curriculum !== undefined) {
    try { data.curriculum = typeof body.curriculum === 'string' ? JSON.parse(body.curriculum) : body.curriculum; } catch { throw new Error('Curriculum must be valid JSON'); }
    if (!Array.isArray(data.curriculum) || data.curriculum.length > 100) throw new Error('Curriculum must be a list');
  }
  if (creating || body.type === 'video') data.type = 'video';
  return data;
};
const parseSession = (body, current = {}) => {
  const data = {};
  for (const key of ['title', 'mode', 'location', 'meetingUrl', 'notes']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || body[key].length > (key === 'title' ? 200 : 4000)) throw new Error(`Invalid ${key}`);
      data[key] = body[key].trim();
    }
  }
  for (const key of ['startsAt', 'endsAt']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(body[key]) || !Number.isFinite(Date.parse(body[key]))) throw new Error(`${key} must include a timezone`);
      data[key] = new Date(body[key]);
    }
  }
  const merged = { ...current, ...data };
  if (!merged.title) throw new Error('Session title is required');
  if (!['physical', 'online'].includes(merged.mode)) throw new Error('Choose a physical or online session');
  if (!merged.startsAt || !merged.endsAt || new Date(merged.endsAt) <= new Date(merged.startsAt)) throw new Error('End time must be after start time');
  if (merged.mode === 'physical' && !merged.location) throw new Error('Physical sessions require a location');
  if (merged.mode === 'online' && !httpUrl(merged.meetingUrl)) throw new Error('Online sessions require a valid HTTP(S) meeting link');
  data.location = merged.mode === 'physical' ? merged.location : null;
  data.meetingUrl = merged.mode === 'online' ? merged.meetingUrl : null;
  if (body.status !== undefined) {
    const transitions = { scheduled: ['live', 'cancelled'], live: ['completed', 'cancelled'], completed: [], cancelled: [] };
    if (body.status !== current.status && !transitions[current.status]?.includes(body.status)) throw new Error('Invalid session status transition');
    data.status = body.status;
  }
  return data;
};
const canJoin = (session, enrollment) => session.mode === 'online' && session.status === 'live' && new Date(session.endsAt) > new Date() && !!enrollment && ['active', 'completed'].includes(enrollment.status) && (!session.batchId || session.batchId === enrollment.batchId);
module.exports = { STAFF_ROLES, isAdmin, ownsCourse, publicCourse, httpUrl, parseCourse, parseSession, canJoin };
