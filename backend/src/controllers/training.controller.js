const {
  Training,
  CourseProgress,
  CourseEnrollment,
  CourseQuiz,
  CourseQuizQuestion,
  CourseQuizAttempt,
  User
} = require('../models/index');
const { cloudinary } = require('../config/cloudinary');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const buildCertificateId = (trainingId, userId) => {
  return `CERT-${String(trainingId).slice(0, 8).toUpperCase()}-${String(userId).slice(0, 8).toUpperCase()}`;
};

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

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    res.json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      providerId: req.user.id
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
      courseData.skills = courseData.skills.split(',').map((s) => s.trim());
    }

    if (typeof courseData.curriculum === 'string') {
      try {
        courseData.curriculum = JSON.parse(courseData.curriculum);
      } catch {
        courseData.curriculum = [];
      }
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

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

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
      updateData.skills = updateData.skills.split(',').map((s) => s.trim());
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

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

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

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const existingEnrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id
      }
    });

    if (existingEnrollment) {
      return res.json({
        success: true,
        message: 'Already enrolled',
        data: existingEnrollment
      });
    }

    const enrollment = await CourseEnrollment.create({
      userId: req.user.id,
      trainingId: req.params.id,
      status: 'active'
    });

    await course.increment('enrollmentCount');

    res.json({
      success: true,
      message: 'Enrolled successfully!',
      data: enrollment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyEnrollmentStatus = async (req, res) => {
  try {
    const course = await Training.findByPk(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id,
        status: ['active', 'completed']
      }
    });

    return res.json({
      success: true,
      enrolled: !!enrollment,
      data: enrollment || null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getMyEnrolledCourses = async (req, res) => {
  try {
    const enrollments = await CourseEnrollment.findAll({
      where: {
        userId: req.user.id,
        status: ['active', 'completed']
      },
      include: [
        {
          model: Training,
          as: 'training'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const courses = enrollments
      .map((item) => item.training)
      .filter(Boolean);

    return res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getMyCourseProgress = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id,
        status: ['active', 'completed']
      }
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Please enroll in this course first'
      });
    }

    const progress = await CourseProgress.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id
      }
    });

    return res.json({
      success: true,
      data: progress || {
        userId: req.user.id,
        trainingId: req.params.id,
        progressPercent: 0,
        completed: false,
        completedAt: null,
        lastWatchedAt: null,
        watchTimeSeconds: 0
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateMyCourseProgress = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id,
        status: ['active', 'completed']
      }
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Please enroll in this course first'
      });
    }

    const { progressPercent, watchTimeSeconds } = req.body;

    let safeProgress = Number(progressPercent ?? 0);
    let safeWatchTime = Number(watchTimeSeconds ?? 0);

    if (Number.isNaN(safeProgress)) safeProgress = 0;
    if (Number.isNaN(safeWatchTime)) safeWatchTime = 0;

    safeProgress = Math.max(0, Math.min(100, safeProgress));
    safeWatchTime = Math.max(0, Math.floor(safeWatchTime));

    let progress = await CourseProgress.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id
      }
    });

    if (!progress) {
      const completed = safeProgress >= 90;

      progress = await CourseProgress.create({
        userId: req.user.id,
        trainingId: req.params.id,
        progressPercent: safeProgress,
        completed,
        completedAt: completed ? new Date() : null,
        lastWatchedAt: new Date(),
        watchTimeSeconds: safeWatchTime
      });
    } else {
      const nextProgress = Math.max(progress.progressPercent || 0, safeProgress);
      const nextWatchTime = Math.max(progress.watchTimeSeconds || 0, safeWatchTime);
      const nextCompleted = nextProgress >= 90;

      await progress.update({
        progressPercent: nextProgress,
        completed: nextCompleted,
        completedAt: !progress.completed && nextCompleted ? new Date() : progress.completedAt,
        lastWatchedAt: new Date(),
        watchTimeSeconds: nextWatchTime
      });

      await progress.reload();
    }

    if (progress.completed && enrollment.status !== 'completed') {
      await enrollment.update({
        status: 'completed'
      });
    }

    return res.json({
      success: true,
      message: 'Course progress updated successfully',
      data: progress
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getMyCourseCertificate = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id,
        status: 'completed'
      }
    });

    const progress = await CourseProgress.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id
      }
    });

    const latestPassedAttempt = await CourseQuizAttempt.findOne({
      where: {
        trainingId: req.params.id,
        userId: req.user.id,
        passed: true
      },
      order: [['attemptedAt', 'DESC']]
    });

    if (!enrollment || !progress || !progress.completed || !latestPassedAttempt) {
      return res.status(403).json({
        success: false,
        message: 'Certificate is available only after course completion and quiz passing'
      });
    }

    const learnerName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.name ||
      user.email ||
      'Learner';

    const completionDate = progress.completedAt || enrollment.updatedAt || new Date();
    const certificateId = buildCertificateId(training.id, user.id);

    return res.json({
      success: true,
      data: {
        certificateId,
        learnerName,
        courseTitle: training.title,
        category: training.category,
        completionDate,
        issuedBy: 'InstaHire Training & Certification',
        skills: training.skills || [],
        progressPercent: progress.progressPercent || 100
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.verifyCertificateById = async (req, res) => {
  try {
    const certificateId = String(req.params.certificateId || '').trim().toUpperCase();

    if (!certificateId.startsWith('CERT-')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid certificate ID format'
      });
    }

    const parts = certificateId.split('-');
    if (parts.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid certificate ID format'
      });
    }

    const trainingPrefix = parts[1];
    const userPrefix = parts[2];

    const trainings = await Training.findAll();
    const users = await User.findAll();

    let matchedTraining = null;
    let matchedUser = null;

    for (const training of trainings) {
      if (String(training.id).slice(0, 8).toUpperCase() === trainingPrefix) {
        matchedTraining = training;
        break;
      }
    }

    for (const user of users) {
      if (String(user.id).slice(0, 8).toUpperCase() === userPrefix) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedTraining || !matchedUser) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: matchedUser.id,
        trainingId: matchedTraining.id,
        status: 'completed'
      }
    });

    const progress = await CourseProgress.findOne({
      where: {
        userId: matchedUser.id,
        trainingId: matchedTraining.id,
        completed: true
      }
    });

    const latestPassedAttempt = await CourseQuizAttempt.findOne({
      where: {
        trainingId: matchedTraining.id,
        userId: matchedUser.id,
        passed: true
      },
      order: [['attemptedAt', 'DESC']]
    });

    if (!enrollment || !progress || !latestPassedAttempt) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found or requirements not completed'
      });
    }

    const learnerName =
      [matchedUser.firstName, matchedUser.lastName].filter(Boolean).join(' ').trim() ||
      matchedUser.name ||
      matchedUser.email ||
      'Learner';

    return res.json({
      success: true,
      data: {
        valid: true,
        certificateId,
        learnerName,
        courseTitle: matchedTraining.title,
        category: matchedTraining.category,
        completionDate: progress.completedAt || enrollment.updatedAt,
        issuedBy: 'InstaHire Training & Certification',
        skills: matchedTraining.skills || []
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.downloadMyCourseCertificatePdf = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id,
        status: 'completed'
      }
    });

    const progress = await CourseProgress.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id
      }
    });

    if (!enrollment || !progress || !progress.completed) {
      return res.status(403).json({
        success: false,
        message: 'Certificate is available only after course completion'
      });
    }

    const learnerName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.name ||
      user.email ||
      'Learner';

    const completionDate = progress.completedAt || enrollment.updatedAt || new Date();
    const certificateId = buildCertificateId(training.id, user.id);

    const safeCourseTitle = String(training.title || 'certificate')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();

    const verifyUrl = `http://localhost:3000/training/certificate/verify?certificateId=${encodeURIComponent(certificateId)}`;

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 220,
      color: {
        dark: '#111827',
        light: '#FFFFFF'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeCourseTitle}_certificate.pdf"`
    );

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40
    });

    doc.pipe(res);

    doc.rect(20, 20, 802, 555).lineWidth(5).stroke('#16a34a');
    doc.rect(32, 32, 778, 531).lineWidth(1.5).stroke('#86efac');

    doc
      .fontSize(18)
      .fillColor('#16a34a')
      .text('CERTIFICATE OF COMPLETION', 0, 68, { align: 'center' });

    doc
      .moveDown(0.8)
      .fontSize(32)
      .fillColor('#111827')
      .text('InstaHire Training & Certification', { align: 'center' });

    doc
      .moveDown(1.8)
      .fontSize(16)
      .fillColor('#6b7280')
      .text('This certificate is proudly presented to', { align: 'center' });

    doc
      .moveDown(0.8)
      .fontSize(30)
      .fillColor('#111827')
      .text(learnerName, { align: 'center', underline: true });

    doc
      .moveDown(1.2)
      .fontSize(16)
      .fillColor('#6b7280')
      .text('for successfully completing the course', { align: 'center' });

    doc
      .moveDown(0.8)
      .fontSize(24)
      .fillColor('#16a34a')
      .text(training.title || 'Course', { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#111827')
      .text(`Category: ${training.category || 'General'}`, 90, 355);

    doc
      .fontSize(14)
      .fillColor('#111827')
      .text(
        `Completion Date: ${new Date(completionDate).toLocaleDateString()}`,
        90,
        385
      );

    doc
      .fontSize(14)
      .fillColor('#111827')
      .text(`Certificate ID: ${certificateId}`, 90, 415);

    doc
      .fontSize(14)
      .fillColor('#111827')
      .text(`Issued By: InstaHire Training & Certification`, 90, 445);

    if (training.skills && training.skills.length > 0) {
      doc
        .fontSize(14)
        .fillColor('#111827')
        .text(`Skills: ${training.skills.join(', ')}`, 90, 475, {
          width: 430
        });
    }

    doc
      .fontSize(12)
      .fillColor('#6b7280')
      .text('Scan to verify certificate', 590, 360, {
        width: 150,
        align: 'center'
      });

    doc.image(qrDataUrl, 595, 385, {
      fit: [130, 130],
      align: 'center',
      valign: 'center'
    });

    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .text(certificateId, 560, 525, {
        width: 200,
        align: 'center'
      });

    doc
      .moveTo(575, 342)
      .lineTo(705, 342)
      .strokeColor('#9ca3af')
      .stroke();

    doc.end();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.upsertCourseQuiz = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const {
      title = 'Final Course Quiz',
      description = '',
      passPercentage = 70,
      isActive = true,
      questions = []
    } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one question is required'
      });
    }

    let quiz = await CourseQuiz.findOne({
      where: { trainingId: req.params.id }
    });

    if (!quiz) {
      quiz = await CourseQuiz.create({
        trainingId: req.params.id,
        title,
        description,
        passPercentage,
        isActive
      });
    } else {
      await quiz.update({
        title,
        description,
        passPercentage,
        isActive
      });

      await CourseQuizQuestion.destroy({
        where: { quizId: quiz.id }
      });
    }

    const preparedQuestions = questions.map((item, index) => ({
      quizId: quiz.id,
      question: item.question,
      optionA: item.optionA,
      optionB: item.optionB,
      optionC: item.optionC,
      optionD: item.optionD,
      correctOption: String(item.correctOption || '').toUpperCase(),
      marks: Number(item.marks || 1),
      sortOrder: Number(item.sortOrder ?? index + 1)
    }));

    await CourseQuizQuestion.bulkCreate(preparedQuestions);

    const savedQuiz = await CourseQuiz.findByPk(quiz.id, {
      include: [
        {
          model: CourseQuizQuestion,
          as: 'questions',
          order: [['sortOrder', 'ASC']]
        }
      ]
    });

    return res.json({
      success: true,
      message: 'Course quiz saved successfully',
      data: savedQuiz
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getCourseQuizForAdmin = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const quiz = await CourseQuiz.findOne({
      where: { trainingId: req.params.id },
      include: [
        {
          model: CourseQuizQuestion,
          as: 'questions'
        }
      ],
      order: [[{ model: CourseQuizQuestion, as: 'questions' }, 'sortOrder', 'ASC']]
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    return res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getCourseQuizForCandidate = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id,
        status: ['active', 'completed']
      }
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Please enroll in this course first'
      });
    }

    const progress = await CourseProgress.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id
      }
    });

    if (!progress || !progress.completed) {
      return res.status(403).json({
        success: false,
        message: 'Please complete the course before taking the quiz'
      });
    }

    const quiz = await CourseQuiz.findOne({
      where: {
        trainingId: req.params.id,
        isActive: true
      },
      include: [
        {
          model: CourseQuizQuestion,
          as: 'questions',
          attributes: {
            exclude: ['correctOption', 'createdAt', 'updatedAt']
          }
        }
      ],
      order: [[{ model: CourseQuizQuestion, as: 'questions' }, 'sortOrder', 'ASC']]
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found for this course'
      });
    }

    return res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.submitCourseQuiz = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const enrollment = await CourseEnrollment.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id,
        status: ['active', 'completed']
      }
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Please enroll in this course first'
      });
    }

    const progress = await CourseProgress.findOne({
      where: {
        userId: req.user.id,
        trainingId: req.params.id
      }
    });

    if (!progress || !progress.completed) {
      return res.status(403).json({
        success: false,
        message: 'Please complete the course before submitting the quiz'
      });
    }

    const quiz = await CourseQuiz.findOne({
      where: {
        trainingId: req.params.id,
        isActive: true
      },
      include: [
        {
          model: CourseQuizQuestion,
          as: 'questions'
        }
      ],
      order: [[{ model: CourseQuizQuestion, as: 'questions' }, 'sortOrder', 'ASC']]
    });

    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found for this course'
      });
    }

    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

    if (answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No answers submitted'
      });
    }

    const answerMap = {};
    for (const item of answers) {
      if (item && item.questionId) {
        answerMap[item.questionId] = String(item.selectedOption || '').toUpperCase();
      }
    }

    let score = 0;
    let totalMarks = 0;

    const evaluatedAnswers = quiz.questions.map((question) => {
      const selectedOption = answerMap[question.id] || null;
      const isCorrect = selectedOption === question.correctOption;
      const marks = Number(question.marks || 1);

      totalMarks += marks;
      if (isCorrect) score += marks;

      return {
        questionId: question.id,
        selectedOption,
        correctOption: question.correctOption,
        isCorrect,
        marks
      };
    });

    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
    const passed = percentage >= Number(quiz.passPercentage || 70);

    const attempt = await CourseQuizAttempt.create({
      quizId: quiz.id,
      trainingId: req.params.id,
      userId: req.user.id,
      score,
      totalMarks,
      percentage,
      passed,
      answers: evaluatedAnswers,
      attemptedAt: new Date()
    });

    return res.json({
      success: true,
      message: passed ? 'Quiz passed successfully' : 'Quiz submitted',
      data: {
        id: attempt.id,
        score,
        totalMarks,
        percentage,
        passed,
        passPercentage: quiz.passPercentage,
        attemptedAt: attempt.attemptedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getMyCourseQuizResult = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const attempt = await CourseQuizAttempt.findOne({
      where: {
        trainingId: req.params.id,
        userId: req.user.id
      },
      order: [['attemptedAt', 'DESC']]
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'No quiz attempt found'
      });
    }

    return res.json({
      success: true,
      data: attempt
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteCourseQuiz = async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const quiz = await CourseQuiz.findOne({
      where: { trainingId: req.params.id }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    await CourseQuizQuestion.destroy({
      where: { quizId: quiz.id }
    });

    await CourseQuizAttempt.destroy({
      where: { quizId: quiz.id }
    });

    await quiz.destroy();

    return res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};