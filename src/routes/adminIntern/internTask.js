const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const tasksController = require('../controllers/tasksController');

router.get('/', authenticateAdmin, tasksController.getAllTasks);
router.post('/', authenticateAdmin, tasksController.createTask);
router.put('/:id', authenticateAdmin, tasksController.updateTask);

module.exports = router;