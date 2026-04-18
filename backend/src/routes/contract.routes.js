const express = require('express');
const router = express.Router();

const {
  createContract,
  getEmployerContracts,
  updateContractStatus,
} = require('../controllers/contract.controller');

const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('employer'), createContract);
router.get('/', protect, authorize('employer'), getEmployerContracts);
router.patch('/:id/status', protect, authorize('employer'), updateContractStatus);

module.exports = router;