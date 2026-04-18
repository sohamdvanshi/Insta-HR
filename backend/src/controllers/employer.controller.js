const { EmployerProfile, Job, Application, User, CandidateProfile } = require('../models/index');
const { cloudinary } = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { Op } = require('sequelize');

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

// GET employer profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await EmployerProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET my jobs for employer dashboard
exports.getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.findAll({
      where: { employerId: req.user.id },
      include: [
        {
          model: Application,
          as: 'applications',
          attributes: ['id']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formattedJobs = jobs.map((job) => {
      const plain = job.toJSON();
      return {
        ...plain,
        totalApplications: plain.applications ? plain.applications.length : 0
      };
    });

    res.json({ success: true, data: formattedJobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET applications for one employer job
exports.getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findByPk(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.employerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view applications for this job'
      });
    }

    const applications = await Application.findAll({
      where: { jobId },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'email', 'phone', 'role'],
          include: [
            {
              model: CandidateProfile,
              as: 'candidateProfile'
            }
          ]
        },
        {
          model: Job,
          as: 'job'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (err) {
    console.error('getJobApplications error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};

// GET public profile by userId
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

exports.getCandidateDatabank = async (req, res) => {
  try {
    const { keyword, location, industry, minExperience, skills } = req.query;

    const where = {
      isResumePublic: true
    };

    if (location) {
      where.currentLocation = {
        [Op.iLike]: `%${location}%`
      };
    }

    if (industry) {
      where.industry = {
        [Op.iLike]: `%${industry}%`
      };
    }

    if (minExperience) {
      where.yearsOfExperience = {
        [Op.gte]: Number(minExperience)
      };
    }

    const candidates = await CandidateProfile.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'phone', 'role']
        }
      ],
      order: [['updatedAt', 'DESC']]
    });

    let filteredCandidates = candidates;

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();

      filteredCandidates = filteredCandidates.filter((candidate) => {
        const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.toLowerCase();
        const headline = (candidate.headline || '').toLowerCase();
        const summary = (candidate.summary || '').toLowerCase();
        const industryText = (candidate.industry || '').toLowerCase();
        const locationText = (candidate.currentLocation || '').toLowerCase();

        return (
          fullName.includes(lowerKeyword) ||
          headline.includes(lowerKeyword) ||
          summary.includes(lowerKeyword) ||
          industryText.includes(lowerKeyword) ||
          locationText.includes(lowerKeyword)
        );
      });
    }

    if (skills) {
      const skillList = String(skills)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      if (skillList.length > 0) {
        filteredCandidates = filteredCandidates.filter((candidate) => {
          const candidateSkills = Array.isArray(candidate.skills)
            ? candidate.skills.map((s) => String(s).toLowerCase())
            : [];

          return skillList.some((skill) => candidateSkills.includes(skill));
        });
      }
    }

    const formatted = filteredCandidates.map((candidate) => ({
      id: candidate.id,
      userId: candidate.userId,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      headline: candidate.headline,
      summary: candidate.summary,
      skills: candidate.skills || [],
      experience: candidate.experience || [],
      education: candidate.education || [],
      currentLocation: candidate.currentLocation,
      expectedSalary: candidate.expectedSalary,
      yearsOfExperience: candidate.yearsOfExperience,
      resumeUrl: candidate.resumeUrl,
      industry: candidate.industry,
      profileCompleteness: candidate.profileCompleteness,
      email: candidate.user?.email || null,
      phone: candidate.user?.phone || null
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (err) {
    console.error('getCandidateDatabank error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};