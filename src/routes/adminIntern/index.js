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

// ✅ FIXED: Admin Authentication Routes (no /admin prefix needed here)
router.post('/login', adminController.adminLogin);

// ✅ FIXED: Dashboard Routes (remove /admin prefix since it's already in the mount path)
router.get('admin/dashboard/stats', authenticateAdmin, dashboardController.getDashboardStats);
router.get('admin/dashboard/activities', authenticateAdmin, dashboardController.getRecentActivities);

// ✅ FIXED: Intern Management Routes  
router.get('admin/interns', authenticateAdmin, internsController.getInterns);
router.put('admin/interns/:id/status', authenticateAdmin, internsController.updateInternStatus);
router.put('admin/interns/:id/progress', authenticateAdmin, internsController.updateInternProgress);

// ✅ FIXED: Tasks Management Routes
router.get('admin/tasks', authenticateAdmin, tasksController.getTasks);
router.post('admin/tasks', authenticateAdmin, tasksController.createTask);
router.put('admin/tasks/:id', authenticateAdmin, tasksController.updateTask);

// ✅ FIXED: Learning Resources Routes
router.get('admin/resources', authenticateAdmin, resourcesController.getResources);
router.post('admin/resources', authenticateAdmin, upload.single('file'), resourcesController.uploadResource);

// ✅ FIXED: Attendance Routes
router.get('admin/attendance', authenticateAdmin, attendanceController.getAttendance);
router.post('admin/attendance', authenticateAdmin, attendanceController.markAttendance);

// ✅ FIXED: Certificate Routes
router.get('admin/certificates', authenticateAdmin, certificatesController.getCertificates);
router.put('admin/certificates/:id/approve', authenticateAdmin, certificatesController.approveCertificate);

// ✅ FIXED: Batches Routes
router.get('admin/batches', authenticateAdmin, batchesController.getBatches);

module.exports = router;