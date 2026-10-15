const { CandidateProfile, Job } = require('../models/index');
const { cloudinary } = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { candidateFields } = require('../services/profileFields');

function profileError(res, error) {
  if (error.name === 'SequelizeForeignKeyConstraintError' || error.parent?.code === '23503') {
    console.error('Candidate profile foreign key requires schema repair');
    return res.status(503).json({ success: false, code: 'PROFILE_SCHEMA_MISMATCH', message: 'Profile storage needs an update. Please contact support.' });
  }
  return res.status(error.name === 'SequelizeValidationError' ? 400 : 500).json({ success: false, message: error.message });
}

// Cloudinary storage for photos
const photoStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'instahire/photos', resource_type: 'image', transformation: [{ width: 400, height: 400, crop: 'fill' }] }
});

// Cloudinary storage for resumes
const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'instahire/resumes', resource_type: 'raw', allowed_formats: ['pdf', 'doc', 'docx'] }
});

exports.uploadPhotoMiddleware = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } }).single('photo');
exports.uploadResumeMiddleware = multer({ storage: resumeStorage, limits: { fileSize: 10 * 1024 * 1024 } }).single('resume');

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await CandidateProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error) {
    profileError(res, error);
  }
};

// Create Profile
exports.createProfile = async (req, res) => {
  try {
    const existing = await CandidateProfile.findOne({ where: { userId: req.user.id } });
    if (existing) return res.status(400).json({ success: false, message: 'Profile already exists' });
    const profile = await CandidateProfile.create({ ...candidateFields(req.body), userId: req.user.id });
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    profileError(res, error);
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    let profile = await CandidateProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await CandidateProfile.create({ ...candidateFields(req.body), userId: req.user.id });
    } else {
      await profile.update(candidateFields(req.body));
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    profileError(res, error);
  }
};

// Upload Photo
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const profile = await CandidateProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    if (profile.photoPublicId) {
      await cloudinary.uploader.destroy(profile.photoPublicId);
    }
    await profile.update({ photoUrl: req.file.path, photoPublicId: req.file.filename });
    res.json({ success: true, message: 'Photo uploaded!', photoUrl: req.file.path });
  } catch (error) {
    profileError(res, error);
  }
};

// Upload Resume
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const profile = await CandidateProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    if (profile.resumePublicId) {
      await cloudinary.uploader.destroy(profile.resumePublicId, { resource_type: 'raw' });
    }
    await profile.update({ resumeUrl: req.file.path, resumePublicId: req.file.filename });
    res.json({ success: true, message: 'Resume uploaded!', resumeUrl: req.file.path });
  } catch (error) {
    profileError(res, error);
  }
};

// AI Match
exports.getAIMatches = async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    if (req.user.role === 'employer' && String(job.employerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to screen this job' });
    }

    const candidates = await require('../services/candidateDiscovery').matchingCandidates(job.id);
    const result = await require('../services/candidateMatching').matchCandidates(job, candidates);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED' || ['TimeoutError', 'AbortError'].includes(error.name)) return res.status(503).json({ success: false, message: 'AI service unavailable' });
    res.status(500).json({ success: false, message: error.message });
  }
};
