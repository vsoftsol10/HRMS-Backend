const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const attendanceController = require('../../controllers/attendanceController');

router.get('/', authenticateAdmin, attendanceController.getAttendance);
router.post('/', authenticateAdmin, attendanceController.markAttendance);

module.exports = router;