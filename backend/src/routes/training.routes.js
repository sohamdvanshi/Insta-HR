const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/training.controller');
const { protect, authorize } = require('../middleware/auth');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');
const multer = require('multer');

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.fieldname === 'video') {
      return {
        folder: 'instahire/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi'],
      };
    } else {
      return {
        folder: 'instahire/thumbnails',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 640, height: 360, crop: 'fill' }],
      };
    }
  },
});

const upload = multer({ storage }).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

// Public routes
router.get('/', trainingController.getAllCourses);
router.get('/:id', trainingController.getCourse);

// Protected routes
router.post('/', protect, authorize('employer', 'admin'), upload, trainingController.createCourse);
router.put('/:id', protect, authorize('employer', 'admin'), upload, trainingController.updateCourse);
router.delete('/:id', protect, authorize('employer', 'admin'), trainingController.deleteCourse);
router.post('/:id/enroll', protect, trainingController.enrollCourse);

module.exports = router;
