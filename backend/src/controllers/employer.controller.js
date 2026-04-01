const { EmployerProfile } = require('../models/index');
const { cloudinary } = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cloudinary storage for logos
const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'instahire/logos',
    resource_type: 'image',
    transformation: [{ width: 300, height: 300, crop: 'fit' }]
  }
});

exports.uploadLogoMiddleware = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('logo');

// GET profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await EmployerProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET public profile by userId (for candidates viewing company)
exports.getPublicProfile = async (req, res) => {
  try {
    const profile = await EmployerProfile.findOne({ where: { userId: req.params.userId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Company profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE or UPDATE profile
exports.upsertProfile = async (req, res) => {
  try {
    let profile = await EmployerProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await EmployerProfile.create({ ...req.body, userId: req.user.id });
    } else {
      await profile.update(req.body);
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPLOAD LOGO
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    let profile = await EmployerProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Create company profile first' });
    // Delete old logo
    if (profile.logoPublicId) {
      await cloudinary.uploader.destroy(profile.logoPublicId);
    }
    await profile.update({ logoUrl: req.file.path, logoPublicId: req.file.filename });
    res.json({ success: true, message: 'Logo uploaded!', logoUrl: req.file.path });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: get all employer profiles
exports.getAllProfiles = async (req, res) => {
  try {
    const profiles = await EmployerProfile.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: profiles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: verify employer
exports.verifyEmployer = async (req, res) => {
  try {
    const profile = await EmployerProfile.findOne({ where: { userId: req.params.userId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    await profile.update({ isVerified: true });
    res.json({ success: true, message: 'Employer verified!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
