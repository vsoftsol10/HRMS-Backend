const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import controllers
const adminController = require('../../controllers/admin/adminController');
const dashboardController = require('../../controllers/admin/dashboardController');
const internsController = require('../../controllers/admin/internsController');
const tasksController = require('../../controllers/admin/taskController');
const resourcesController = require('../../controllers/admin/resourcesController');
const attendanceController = require('../../controllers/admin/attendaceController');
const certificatesController = require('../../controllers/admin/certificatesController');
const batchesController = require('../../controllers/admin/batchController');

// const dashboardRoutes = require("../routes/dashboardRoute")


// Import middleware
const { authenticateAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Admin Authentication Routes
router.post('/login', adminController.adminLogin);

// Dashboard Routes
router.get('/admin/dashboard/stats', authenticateAdmin, dashboardController.getDashboardStats);
router.get('/admin/dashboard/activities', authenticateAdmin, dashboardController.getRecentActivities);

// Intern Management Routes
router.get('/admin/interns', authenticateAdmin, internsController.getInterns);
router.put('/admin/interns/:id/status', authenticateAdmin, internsController.updateInternStatus);
router.put('/admin/interns/:id/progress', authenticateAdmin, internsController.updateInternProgress);

// Tasks Management Routes
router.get('/admin/tasks', authenticateAdmin, tasksController.getTasks);
router.post('/admin/tasks', authenticateAdmin, tasksController.createTask);
router.put('/admin/tasks/:id', authenticateAdmin, tasksController.updateTask);

// Learning Resources Routes
router.get('/admin/resources', authenticateAdmin, resourcesController.getResources);
router.post('/admin/resources', authenticateAdmin, upload.single('file'), resourcesController.uploadResource);

// Attendance Routes
router.get('/admin/attendance', authenticateAdmin, attendanceController.getAttendance);
router.post('/admin/attendance', authenticateAdmin, attendanceController.markAttendance);

// Certificate Routes
router.get('/admin/certificates', authenticateAdmin, certificatesController.getCertificates);
router.put('/admin/certificates/:id/approve', authenticateAdmin, certificatesController.approveCertificate);

// Batches Routes
router.get('/admin/batches', authenticateAdmin, batchesController.getBatches);

module.exports = router;