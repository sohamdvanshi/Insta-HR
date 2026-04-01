const { Training } = require('../models/index');
const { cloudinary } = require('../config/cloudinary');

exports.getAllCourses = async (req, res) => {
  try {
    const { category, isFree, type } = req.query;
    const where = { status: 'active' };
    if (category && category !== 'All') where.category = category;
    if (isFree === 'true') where.isFree = true;
    if (type && type !== 'all') where.type = type;
    const courses = await Training.findAll({
      where,
      order: [['enrollmentCount', 'DESC']]
    });
    res.json({ success: true, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCourse = async (req, res) => {
  try {
    const course = await Training.findByPk(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      providerId: req.user.id,
    };
    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        courseData.thumbnail = req.files.thumbnail[0].path;
        courseData.thumbnailPublicId = req.files.thumbnail[0].filename;
      }
      if (req.files.video && req.files.video[0]) {
        courseData.videoUrl = req.files.video[0].path;
        courseData.videoPublicId = req.files.video[0].filename;
      }
    }
    if (typeof courseData.skills === 'string') {
      courseData.skills = courseData.skills.split(',').map(s => s.trim());
    }
    if (typeof courseData.curriculum === 'string') {
      try { courseData.curriculum = JSON.parse(courseData.curriculum); } catch { courseData.curriculum = []; }
    }
    const course = await Training.create(courseData);
    res.status(201).json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const course = await Training.findByPk(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const updateData = { ...req.body };
    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        if (course.thumbnailPublicId) {
          await cloudinary.uploader.destroy(course.thumbnailPublicId);
        }
        updateData.thumbnail = req.files.thumbnail[0].path;
        updateData.thumbnailPublicId = req.files.thumbnail[0].filename;
      }
      if (req.files.video && req.files.video[0]) {
        if (course.videoPublicId) {
          await cloudinary.uploader.destroy(course.videoPublicId, { resource_type: 'video' });
        }
        updateData.videoUrl = req.files.video[0].path;
        updateData.videoPublicId = req.files.video[0].filename;
      }
    }
    if (typeof updateData.skills === 'string') {
      updateData.skills = updateData.skills.split(',').map(s => s.trim());
    }
    await course.update(updateData);
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const course = await Training.findByPk(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.thumbnailPublicId) {
      await cloudinary.uploader.destroy(course.thumbnailPublicId);
    }
    if (course.videoPublicId) {
      await cloudinary.uploader.destroy(course.videoPublicId, { resource_type: 'video' });
    }
    await course.destroy();
    res.json({ success: true, message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.enrollCourse = async (req, res) => {
  try {
    const course = await Training.findByPk(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    await course.increment('enrollmentCount');
    res.json({ success: true, message: 'Enrolled successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
