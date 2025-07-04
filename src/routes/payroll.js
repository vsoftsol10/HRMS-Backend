const express = require('express');
const { body, param, query } = require('express-validator');
const PayrollController = require('../controllers/payrollController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

// Validation middleware for payroll creation/update
const payrollValidation = [
  body('employee_id')
    .isInt({ min: 1 })
    .withMessage('Valid employee ID is required'),
  body('pay_period_start')
    .isISO8601()
    .withMessage('Valid start date is required (YYYY-MM-DD)'),
  body('pay_period_end')
    .isISO8601()
    .withMessage('Valid end date is required (YYYY-MM-DD)'),
  body('basic_salary')
    .isFloat({ min: 0 })
    .withMessage('Basic salary must be a positive number'),
  body('allowances')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Allowances must be a positive number'),
  body('overtime_hours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Overtime hours must be a positive number'),
  body('overtime_rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Overtime rate must be a positive number'),
  body('tax_deduction')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax deduction must be a positive number'),
  body('insurance_deduction')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Insurance deduction must be a positive number'),
  body('other_deductions')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Other deductions must be a positive number')
];

// Validation for bulk payroll generation
const bulkPayrollValidation = [
  body('employee_ids')
    .isArray({ min: 1 })
    .withMessage('Employee IDs array is required'),
  body('employee_ids.*')
    .isInt({ min: 1 })
    .withMessage('Each employee ID must be a valid integer'),
  body('pay_period_start')
    .isISO8601()
    .withMessage('Valid start date is required (YYYY-MM-DD)'),
  body('pay_period_end')
    .isISO8601()
    .withMessage('Valid end date is required (YYYY-MM-DD)'),
  body('default_overtime_rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Default overtime rate must be a positive number')
];

// ID parameter validation
const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid payroll ID is required')
];

const employeeIdValidation = [
  param('employeeId')
    .isInt({ min: 1 })
    .withMessage('Valid employee ID is required')
];

// Apply authentication middleware to all routes
router.use(auth);

// GET /api/payroll - Get all payroll records (Admin/HR only)
router.get('/', 
  roleCheck(['admin', 'hr']), 
  PayrollController.getAllPayrolls
);

// GET /api/payroll/statistics - Get payroll statistics (Admin/HR only)
router.get('/statistics',
  roleCheck(['admin', 'hr']),
  PayrollController.getPayrollStatistics
);

// GET /api/payroll/:id - Get specific payroll record
router.get('/:id',
  idValidation,
  PayrollController.getPayrollById
);

// POST /api/payroll - Create new payroll record (Admin/HR only)
router.post('/',
  roleCheck(['admin', 'hr']),
  payrollValidation,
  PayrollController.createPayroll
);

// POST /api/payroll/bulk - Generate bulk payroll (Admin/HR only)
router.post('/bulk',
  roleCheck(['admin', 'hr']),
  bulkPayrollValidation,
  PayrollController.generateBulkPayroll
);

// PUT /api/payroll/:id - Update payroll record (Admin/HR only)
router.put('/:id',
  roleCheck(['admin', 'hr']),
  idValidation,
  payrollValidation,
  PayrollController.updatePayroll
);

// PATCH /api/payroll/:id/payment-status - Update payment status (Admin/HR only)
router.patch('/:id/payment-status',
  roleCheck(['admin', 'hr']),
  idValidation,
  [
    body('status')
      .isIn(['pending', 'paid', 'cancelled'])
      .withMessage('Status must be: pending, paid, or cancelled'),
    body('payment_date')
      .optional()
      .isISO8601()
      .withMessage('Payment date must be valid (YYYY-MM-DD)')
  ],
  PayrollController.updatePaymentStatus
);

// DELETE /api/payroll/:id - Delete payroll record (Admin only)
router.delete('/:id',
  roleCheck(['admin']),
  idValidation,
  PayrollController.deletePayroll
);

// GET /api/payroll/employee/:employeeId/summary - Get employee payroll summary
router.get('/employee/:employeeId/summary',
  employeeIdValidation,
  [
    query('year')
      .optional()
      .isInt({ min: 2000, max: 2100 })
      .withMessage('Year must be between 2000 and 2100')
  ],
  PayrollController.getEmployeePayrollSummary
);

module.exports = router;