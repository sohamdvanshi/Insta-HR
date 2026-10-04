const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/training.controller');
const ops = require('../controllers/trainingOps.controller');
const { STAFF_ROLES } = require('../services/trainingPolicy');
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
        allowed_formats: ['mp4', 'mov', 'avi']
      };
    } else {
      return {
        folder: 'instahire/thumbnails',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 640, height: 360, crop: 'fill' }]
      };
    }
  }
});

const uploadFiles = multer({ storage, limits: { fileSize: 500 * 1024 * 1024, files: 2 }, fileFilter: (req, file, cb) => {
  const allowed = file.fieldname === 'video' ? ['video/mp4', 'video/quicktime', 'video/x-msvideo'] : ['image/jpeg', 'image/png', 'image/webp'];
  cb(allowed.includes(file.mimetype) ? null : new Error('Unsupported upload format'), allowed.includes(file.mimetype));
} }).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

const upload = (req, res, next) => uploadFiles(req, res, error => error ? res.status(400).json({ success: false, message: error.message }) : next());
const staff = authorize(...STAFF_ROLES);
const owner = trainingController.requireCourseOwner;

// Static management routes precede /:id.
router.get('/manage/courses', protect, staff, trainingController.getManagedCourses);
router.get('/staff', protect, staff, ops.listStaff);
router.post('/staff', protect, authorize('admin', 'super_admin'), ops.createTrainer);
router.get('/my/classes', protect, authorize('candidate'), ops.mySessions);
router.patch('/batches/:batchId', protect, staff, ops.updateBatch);
router.put('/batches/:batchId/members', protect, staff, ops.setMembers);
router.patch('/sessions/:sessionId', protect, staff, ops.updateSession);
router.post('/sessions/:sessionId/notify', protect, staff, ops.notify);
router.get('/sessions/:sessionId/join', protect, authorize(...STAFF_ROLES, 'candidate'), ops.join);
router.get('/sessions/:sessionId/attendance', protect, staff, ops.getAttendance);
router.put('/sessions/:sessionId/attendance', protect, staff, ops.saveAttendance);
router.get('/:id/batches', protect, staff, ops.listBatches);
router.post('/:id/batches', protect, staff, ops.createBatch);
router.get('/:id/sessions', protect, staff, ops.listSessions);
router.post('/:id/sessions', protect, staff, ops.createSession);
router.get('/:id/enrollments', protect, staff, ops.listEnrollments);
router.post('/:id/enrollments', protect, staff, ops.grantEnrollment);
router.get('/:id/content', protect, trainingController.getCourseContent);

// Public routes
router.get('/', trainingController.getAllCourses);
router.get('/certificate/verify/:certificateId', trainingController.verifyCertificateById);
router.get('/:id', trainingController.getCourse);

// Protected routes
router.post('/', protect, staff, upload, trainingController.createCourse);
router.put('/:id', protect, staff, owner, upload, trainingController.updateCourse);
router.delete('/:id', protect, staff, owner, trainingController.deleteCourse);

router.get('/my/enrolled', protect, authorize('candidate'), trainingController.getMyEnrolledCourses);

router.post('/:id/enroll', protect, authorize('candidate'), trainingController.enrollCourse);
router.get('/:id/enrollment-status', protect, authorize('candidate'), trainingController.getMyEnrollmentStatus);
router.get('/:id/progress', protect, authorize('candidate'), trainingController.getMyCourseProgress);
router.patch('/:id/progress', protect, authorize('candidate'), trainingController.updateMyCourseProgress);
router.get('/:id/certificate', protect, authorize('candidate'), trainingController.getMyCourseCertificate);
router.get('/:id/certificate/pdf', protect, authorize('candidate'), trainingController.downloadMyCourseCertificatePdf);

router.post('/:id/quiz', protect, staff, owner, trainingController.upsertCourseQuiz);
router.get('/:id/quiz/admin', protect, staff, owner, trainingController.getCourseQuizForAdmin);
router.delete('/:id/quiz', protect, staff, owner, trainingController.deleteCourseQuiz);

router.get('/:id/quiz', protect, authorize('candidate'), trainingController.getCourseQuizForCandidate);
router.post('/:id/quiz/submit', protect, authorize('candidate'), trainingController.submitCourseQuiz);
router.get('/:id/quiz/result', protect, authorize('candidate'), trainingController.getMyCourseQuizResult);

module.exports = router;