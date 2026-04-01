const fs = require('fs');
const content = `const { Training } = require('../models/index');

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
    const course = await Training.create({ ...req.body, providerId: req.user.id });
    res.status(201).json({ success: true, data: course });
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

exports.getMyEnrollments = async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
`;
fs.writeFileSync('src/controllers/training.controller.js', content);
console.log('Training controller updated!');