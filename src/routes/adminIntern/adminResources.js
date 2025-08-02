const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const upload = require('../../config/multer');
const resourcesController = require('../controllers/resourcesController');

router.get('/', authenticateAdmin, resourcesController.getAllResources);
router.post('/', authenticateAdmin, upload.single('file'), resourcesController.uploadResource);

module.exports = router;