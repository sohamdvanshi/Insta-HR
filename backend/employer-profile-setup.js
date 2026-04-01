const fs = require('fs');
const path = require('path');

// ─── 1. EMPLOYER PROFILE MODEL ───
const model = `const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmployerProfile = sequelize.define('EmployerProfile', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  companyName: { type: DataTypes.STRING, allowNull: false },
  logoUrl: { type: DataTypes.STRING },
  logoPublicId: { type: DataTypes.STRING },
  tagline: { type: DataTypes.STRING },
  about: { type: DataTypes.TEXT },
  industry: { type: DataTypes.STRING },
  companySize: {
    type: DataTypes.ENUM('1-10','11-50','51-200','201-500','501-1000','1000+'),
    defaultValue: '1-10'
  },
  website: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING, defaultValue: 'India' },
  linkedinUrl: { type: DataTypes.STRING },
  twitterUrl: { type: DataTypes.STRING },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  foundedYear: { type: DataTypes.INTEGER },
  totalJobsPosted: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'EmployerProfiles', timestamps: true });

module.exports = EmployerProfile;
`;
fs.mkdirSync('src/models', { recursive: true });
fs.writeFileSync('src/models/EmployerProfile.js', model);
console.log('✅ EmployerProfile model created');

// ─── 2. EMPLOYER PROFILE CONTROLLER ───
const controller = `const { EmployerProfile } = require('../models/index');
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
`;
fs.mkdirSync('src/controllers', { recursive: true });
fs.writeFileSync('src/controllers/employer.controller.js', controller);
console.log('✅ Employer controller created');

// ─── 3. EMPLOYER PROFILE ROUTES ───
const routes = `const express = require('express');
const router = express.Router();
const employerController = require('../controllers/employer.controller');
const { protect, authorize } = require('../middleware/auth');

// Employer routes
router.get('/profile', protect, authorize('employer'), employerController.getProfile);
router.put('/profile', protect, authorize('employer'), employerController.upsertProfile);
router.post('/logo', protect, authorize('employer'), (req, res, next) => {
  employerController.uploadLogoMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, employerController.uploadLogo);

// Public route - candidates can view company profile
router.get('/public/:userId', employerController.getPublicProfile);

// Admin routes
router.get('/all', protect, authorize('admin'), employerController.getAllProfiles);
router.put('/verify/:userId', protect, authorize('admin'), employerController.verifyEmployer);

module.exports = router;
`;
fs.writeFileSync('src/routes/employer.routes.js', routes);
console.log('✅ Employer routes created');

// ─── 4. UPDATE INDEX.JS TO REGISTER MODEL ───
let indexContent = fs.readFileSync('src/models/index.js', 'utf8');
if (!indexContent.includes('EmployerProfile')) {
  indexContent = indexContent.replace(
    "const Training = require('./Training');",
    "const Training = require('./Training');\nconst EmployerProfile = require('./EmployerProfile');"
  );
  indexContent = indexContent.replace(
    "module.exports = {",
    "module.exports = {\n  EmployerProfile,"
  );
  fs.writeFileSync('src/models/index.js', indexContent);
  console.log('✅ index.js updated with EmployerProfile');
} else {
  console.log('ℹ️  EmployerProfile already in index.js');
}

// ─── 5. REGISTER ROUTE IN SERVER.JS ───
let serverContent = fs.readFileSync('src/server.js', 'utf8');
if (!serverContent.includes('employer.routes')) {
  serverContent = serverContent.replace(
    "app.use('/api/v1/training', require('./routes/training.routes'));",
    "app.use('/api/v1/training', require('./routes/training.routes'));\napp.use('/api/v1/employers', require('./routes/employer.routes'));"
  );
  fs.writeFileSync('src/server.js', serverContent);
  console.log('✅ employer routes registered in server.js');
} else {
  console.log('ℹ️  employer routes already in server.js');
}

console.log('\n🎉 Backend setup complete! Restart backend: npm run dev');