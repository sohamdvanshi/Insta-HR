const { Op } = require('sequelize');
const { Resume } = require('../models');

const VALID_SECTORS = [
  'general',
  'information_technology',
  'sales_marketing',
  'finance',
  'healthcare',
  'manufacturing',
  'retail',
  'hospitality',
  'logistics'
];

const VALID_VISIBILITIES = ['private', 'link'];
const VALID_STATUSES = ['draft', 'published'];

const clearOtherDefaultResumes = async (userId, resumeId = null) => {
  const where = {
    userId,
    isDefault: true
  };

  if (resumeId) {
    where.id = {
      [Op.ne]: resumeId
    };
  }

  await Resume.update(
    { isDefault: false },
    { where }
  );
};

const validateResumeFields = (body) => {
  if (body.sector && !VALID_SECTORS.includes(body.sector)) {
    return `Invalid sector. Allowed values: ${VALID_SECTORS.join(', ')}`;
  }

  if (body.visibility && !VALID_VISIBILITIES.includes(body.visibility)) {
    return `Invalid visibility. Allowed values: ${VALID_VISIBILITIES.join(', ')}`;
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`;
  }

  return null;
};

exports.createResume = async (req, res) => {
  try {
    const validationError = validateResumeFields(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    if (req.body.isDefault === true) {
      await clearOtherDefaultResumes(req.user.id);
    }

    const resume = await Resume.create({
      userId: req.user.id,
      title: req.body.title || 'My Resume',
      template: req.body.template || 'classic',
      sector: req.body.sector || 'general',
      visibility: req.body.visibility || 'private',
      isDefault: req.body.isDefault === true,
      targetJobTitle: req.body.targetJobTitle || '',
      targetJobDescription: req.body.targetJobDescription || '',
      personalInfo: req.body.personalInfo || {
        fullName: '',
        email: '',
        phone: '',
        location: '',
        jobTitle: '',
        linkedin: '',
        github: '',
        website: ''
      },
      summary: req.body.summary || '',
      experience: req.body.experience || [],
      education: req.body.education || [],
      projects: req.body.projects || [],
      skills: req.body.skills || [],
      certifications: req.body.certifications || [],
      languages: req.body.languages || [],
      status: req.body.status || 'draft'
    });

    return res.status(201).json({
      success: true,
      message: 'Resume created successfully',
      data: resume
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create resume',
      error: error.message
    });
  }
};

exports.getMyResumes = async (req, res) => {
  try {
    const resumes = await Resume.findAll({
      where: { userId: req.user.id },
      order: [
        ['isDefault', 'DESC'],
        ['updatedAt', 'DESC']
      ]
    });

    return res.json({
      success: true,
      count: resumes.length,
      data: resumes
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch resumes',
      error: error.message
    });
  }
};

exports.getResumeById = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    return res.json({
      success: true,
      data: resume
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch resume',
      error: error.message
    });
  }
};

exports.getPublicResumeById = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: {
        id: req.params.id
      }
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    if (resume.visibility !== 'link') {
      return res.status(403).json({
        success: false,
        message: 'This resume is not publicly shared'
      });
    }

    return res.json({
      success: true,
      data: resume
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch shared resume',
      error: error.message
    });
  }
};

exports.updateResume = async (req, res) => {
  try {
    const validationError = validateResumeFields(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const resume = await Resume.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    if (req.body.isDefault === true) {
      await clearOtherDefaultResumes(req.user.id, resume.id);
    }

    await resume.update({
      title: req.body.title ?? resume.title,
      template: req.body.template ?? resume.template,
      sector: req.body.sector ?? resume.sector,
      visibility: req.body.visibility ?? resume.visibility,
      isDefault: req.body.isDefault ?? resume.isDefault,
      targetJobTitle: req.body.targetJobTitle ?? resume.targetJobTitle,
      targetJobDescription:
        req.body.targetJobDescription ?? resume.targetJobDescription,
      personalInfo: req.body.personalInfo ?? resume.personalInfo,
      summary: req.body.summary ?? resume.summary,
      experience: req.body.experience ?? resume.experience,
      education: req.body.education ?? resume.education,
      projects: req.body.projects ?? resume.projects,
      skills: req.body.skills ?? resume.skills,
      certifications: req.body.certifications ?? resume.certifications,
      languages: req.body.languages ?? resume.languages,
      status: req.body.status ?? resume.status
    });

    return res.json({
      success: true,
      message: 'Resume updated successfully',
      data: resume
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update resume',
      error: error.message
    });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    await resume.destroy();

    return res.json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete resume',
      error: error.message
    });
  }
};