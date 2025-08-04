const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/authMiddleware');
const internsController = require('../controllers/internsController');

router.get('/', authenticateAdmin, internsController.getAllInterns);
router.put('/:id/status', authenticateAdmin, internsController.updateStatus);
router.put('/:id/progress', authenticateAdmin, internsController.updateProgress);

module.exports = router; 