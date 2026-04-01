const fs = require('fs');
const content = `const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/training.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadVideo, uploadThumbnail } = require('../config/cloudinary');
const multer = require('multer');

const uploadFields = multer({
  storage: multer.memoryStorage(),
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

// Public routes
router.get('/', trainingController.getAllCourses);
router.get('/:id', trainingController.getCourse);

// Protected routes
router.post('/', protect, authorize('employer', 'admin'), uploadFields, trainingController.createCourse);
router.put('/:id', protect, authorize('employer', 'admin'), uploadFields, trainingController.updateCourse);
router.delete('/:id', protect, authorize('employer', 'admin'), trainingController.deleteCourse);
router.post('/:id/enroll', protect, trainingController.enrollCourse);

module.exports = router;
`;
fs.writeFileSync('src/routes/training.routes.js', content);
console.log('Training routes updated!');