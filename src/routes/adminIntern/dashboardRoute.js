const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/authMiddleware');
const dashboardController = require('../../controllers/admin/dashboardController'); // Note: using admin folder

router.get('/admin/dashboard/stats', authenticateAdmin, dashboardController.getDashboardStats);
router.get('/admin/dashboard/activities', authenticateAdmin, dashboardController.getRecentActivities);

module.exports = router;