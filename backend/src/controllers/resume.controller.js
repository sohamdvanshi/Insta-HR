const { Resume } = require('../models')

exports.createResume = async (req, res) => {
  try {
    const resume = await Resume.create({
      userId: req.user.id,
      title: req.body.title || 'My Resume',
      template: req.body.template || 'classic',
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
    })

    res.status(201).json({
      success: true,
      message: 'Resume created successfully',
      data: resume
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create resume',
      error: error.message
    })
  }
}

exports.getMyResumes = async (req, res) => {
  try {
    const resumes = await Resume.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']]
    })

    res.json({
      success: true,
      count: resumes.length,
      data: resumes
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resumes',
      error: error.message
    })
  }
}

exports.getResumeById = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    })

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      })
    }

    res.json({
      success: true,
      data: resume
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resume',
      error: error.message
    })
  }
}

exports.updateResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    })

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      })
    }

    await resume.update({
      title: req.body.title ?? resume.title,
      template: req.body.template ?? resume.template,
      targetJobTitle: req.body.targetJobTitle ?? resume.targetJobTitle,
      targetJobDescription: req.body.targetJobDescription ?? resume.targetJobDescription,
      personalInfo: req.body.personalInfo ?? resume.personalInfo,
      summary: req.body.summary ?? resume.summary,
      experience: req.body.experience ?? resume.experience,
      education: req.body.education ?? resume.education,
      projects: req.body.projects ?? resume.projects,
      skills: req.body.skills ?? resume.skills,
      certifications: req.body.certifications ?? resume.certifications,
      languages: req.body.languages ?? resume.languages,
      status: req.body.status ?? resume.status
    })

    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: resume
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update resume',
      error: error.message
    })
  }
}

exports.deleteResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    })

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      })
    }

    await resume.destroy()

    res.json({
      success: true,
      message: 'Resume deleted successfully'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete resume',
      error: error.message
    })
  }
}