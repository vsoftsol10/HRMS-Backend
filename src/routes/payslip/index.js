const express = require('express');
const payrollRoutes = require('./payroll');
const debugRoutes = require('./debug');
const adminRoutes = require('../adminIntern/index');

const router = express.Router();

// Mount route modules
router.use('/payroll', payrollRoutes);
router.use('/', debugRoutes); // Debug routes at API root level
router.use('/admin', adminRoutes);

module.exports = router;