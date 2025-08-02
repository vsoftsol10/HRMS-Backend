const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const batchesController = require('../controllers/batchesController');

router.get('/', authenticateAdmin, batchesController.getAllBatches);

module.exports = router;