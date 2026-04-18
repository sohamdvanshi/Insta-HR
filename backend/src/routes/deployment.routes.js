const express = require('express');
const router = express.Router();

const {
  createDeployment,
  getEmployerDeployments,
  updateDeploymentStatus,
} = require('../controllers/deployment.controller');

const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('employer'), createDeployment);
router.get('/', protect, authorize('employer'), getEmployerDeployments);
router.patch('/:id/status', protect, authorize('employer'), updateDeploymentStatus);

module.exports = router;