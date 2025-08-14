const express = require('express');
const PayrollController = require('../../controllers/payslip/payrollController');

const router = express.Router();

router.get('/', PayrollController.getAllPayrolls);
router.get('/:id', PayrollController.getPayrollById);
router.post('/', PayrollController.createPayroll);
router.put('/:id', PayrollController.updatePayroll);
router.delete('/:id', PayrollController.deletePayroll);

module.exports = router;