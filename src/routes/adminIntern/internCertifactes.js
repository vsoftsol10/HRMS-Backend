const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const certificatesController = require('../controllers/certificatesController');

router.get('/', authenticateAdmin, certificatesController.getAllCertificates);
router.put('/:id/approve', authenticateAdmin, certificatesController.approveCertificate);

module.exports = router;