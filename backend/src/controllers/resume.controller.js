const { Resume, CandidateProfile, User, sequelize } = require('../models');
const { catalog, sectors, getEntitlement, profileDefaults, validateResume } = require('../services/resumePolicy');
const EDITABLE = ['title', 'template', 'sector', 'visibility', 'isDefault', 'targetJobTitle', 'targetJobDescription', 'personalInfo', 'summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'languages', 'status'];
const pick = body => Object.fromEntries(EDITABLE.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
const failure = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Unable to save or load resume', code: error.code });
const clearDefaults = (userId, transaction) => Resume.update({ isDefault: false }, { where: { userId, isDefault: true }, transaction });
const error = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code });
exports.getCatalog = (req, res) => res.json({ success: true, data: catalog });
exports.getProfileDefaults = async (req, res) => {
  try {
    const profile = await CandidateProfile.findOne({ where: { userId: req.user.id } });
    res.json({ success: true, data: profileDefaults(req.user, profile || {}) });
  } catch (err) { failure(res, err); }
};
exports.createResume = async (req, res) => {
  try {
    const validationError = validateResume(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const resume = await sequelize.transaction(async transaction => {
      // Serialize creation/default changes per user, including simultaneous browser tabs.
      const user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
      const count = await Resume.count({ where: { userId: user.id }, transaction });
      if (!getEntitlement(user, count).canCreate) throw error('Your free plan includes one saved resume. Edit it or upgrade to Premium to create more.', 403, 'RESUME_LIMIT_REACHED');
      const profile = await CandidateProfile.findOne({ where: { userId: user.id }, transaction });
      const sector = req.body.sector || 'general';
      const defaults = profileDefaults(user, profile || {});
      if (req.body.isDefault === true) await clearDefaults(user.id, transaction);
      return Resume.create({
        ...defaults, title: 'My Resume', template: sectors.get(sector).template, sector,
        visibility: 'private', status: 'draft', isDefault: count === 0,
        projects: [], certifications: [], languages: [], ...pick(req.body), userId: user.id,
        personalInfo: { ...defaults.personalInfo, ...(req.body.personalInfo || {}) }
      }, { transaction });
    });
    res.status(201).json({ success: true, data: resume });
  } catch (err) { failure(res, err); }
};
exports.getMyResumes = async (req, res) => {
  try {
    const resumes = await Resume.findAll({ where: { userId: req.user.id }, order: [['isDefault', 'DESC'], ['updatedAt', 'DESC']] });
    res.json({ success: true, count: resumes.length, data: resumes, entitlement: getEntitlement(req.user, resumes.length) });
  } catch (err) { failure(res, err); }
};
exports.getResumeById = async (req, res) => {
  try {
    const resume = await Resume.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found' });
    res.json({ success: true, data: resume });
  } catch (err) { failure(res, err); }
};
exports.getPublicResumeById = async (req, res) => {
  try {
    const resume = await Resume.findOne({ where: { id: req.params.id, visibility: 'link' } });
    if (!resume) return res.status(404).json({ success: false, message: 'Resume is unavailable or no longer shared' });
    // Sharing never exposes ownership IDs, private target-JD notes, or other account metadata.
    const data = pick(resume.toJSON());
    delete data.targetJobDescription;
    delete data.targetJobTitle;
    delete data.isDefault;
    res.set('Cache-Control', 'no-store').json({ success: true, data });
  } catch (err) { failure(res, err); }
};
exports.updateResume = async (req, res) => {
  try {
    const validationError = validateResume(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const resume = await sequelize.transaction(async transaction => {
      await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
      const existing = await Resume.findOne({ where: { id: req.params.id, userId: req.user.id }, transaction });
      if (!existing) throw error('Resume not found', 404);
      if (req.body.isDefault === true) await clearDefaults(req.user.id, transaction);
      return existing.update(pick(req.body), { transaction });
    });
    res.json({ success: true, data: resume });
  } catch (err) { failure(res, err); }
};
exports.deleteResume = async (req, res) => {
  try {
    const count = await Resume.destroy({ where: { id: req.params.id, userId: req.user.id } });
    if (!count) return res.status(404).json({ success: false, message: 'Resume not found' });
    res.json({ success: true, message: 'Resume deleted' });
  } catch (err) { failure(res, err); }
};
