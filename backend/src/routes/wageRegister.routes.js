const router = require('express').Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/wageRegister.controller');
router.use(protect, authorize('employer','super_admin'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024, files: 1, fields: 4 },
  fileFilter: (req,file,cb) => /\.xlsx$/i.test(file.originalname) ? cb(null,true) : cb(new Error('Attendance uploads must be .xlsx; save legacy .xls files as .xlsx in Excel')) }).single('file');
const file = (req,res,next) => upload(req,res,e => e ? res.status(400).json({ message: e.message }) : next());
router.get('/',c.list);
router.post('/preview',authorize('employer'),file,c.preview);
router.post('/',authorize('employer'),file,c.create);
router.get('/:id/export',c.export);
router.get('/:id',c.get);
router.post('/:id/attendance',authorize('employer'),file,c.replaceAttendance);
router.put('/:id',authorize('employer'),c.update);
router.post('/:id/approve',authorize('employer'),c.approve);
module.exports = router;
