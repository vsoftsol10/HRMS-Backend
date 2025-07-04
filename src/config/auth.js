// auth.js - Authentication module
const express = require('express');
const router = express.Router();

// This will be passed from your main server file
let pool;

// Initialize the database pool
const initializeAuth = (dbPool) => {
  pool = dbPool;
};

// POST API - Employee Authentication
router.post('/authenticate', async (req, res) => {
  try {
    const { employeeCode, password } = req.body;
    
    if (!employeeCode || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Employee code and password are required' 
      });
    }
    
    // Query to find employee by employee_id (employee code)
    const [rows] = await pool.execute(
      'SELECT * FROM payrolls WHERE employee_id = ? LIMIT 1', 
      [employeeCode]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid employee code or password' 
      });
    }
    
    const employee = rows[0];
    
    // Simple password check - modify as needed
    if (password !== 'password123') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid employee code or password' 
      });
    }
    
    // Calculate last salary
    const lastSalary = parseFloat(employee.basic_salary) + 
                      parseFloat(employee.overtime) + 
                      parseFloat(employee.bonus) + 
                      parseFloat(employee.allowances) - 
                      parseFloat(employee.leave_deduction) - 
                      parseFloat(employee.lop_deduction) - 
                      parseFloat(employee.late_deduction);
    
    // Return employee information
    const employeeInfo = {
      id: employee.id,
      name: employee.employee_name,
      employeeId: employee.employee_id,
      position: employee.position,
      department: employee.department,
      email: employee.employee_email,
      lastSalary: lastSalary
    };
    
    res.json({ 
      success: true, 
      message: 'Authentication successful',
      employee: employeeInfo 
    });
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication' 
    });
  }
});

// GET API - Employee Dashboard Data
router.get('/employee/:employeeId/dashboard', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    
    const [payrollRows] = await pool.execute(
      'SELECT * FROM payrolls WHERE employee_id = ? ORDER BY created_at DESC', 
      [employeeId]
    );
    
    if (payrollRows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    const latestPayroll = payrollRows[0];
    
    const dashboardData = {
      employee: {
        name: latestPayroll.employee_name,
        employeeId: latestPayroll.employee_id,
        position: latestPayroll.position,
        department: latestPayroll.department,
        email: latestPayroll.employee_email
      },
      payrollHistory: payrollRows.map(row => ({
        id: row.id,
        payPeriod: {
          start: row.pay_period_start,
          end: row.pay_period_end,
          payDate: row.pay_date
        },
        netSalary: parseFloat(row.basic_salary) + 
                  parseFloat(row.overtime) + 
                  parseFloat(row.bonus) + 
                  parseFloat(row.allowances) - 
                  parseFloat(row.leave_deduction) - 
                  parseFloat(row.lop_deduction) - 
                  parseFloat(row.late_deduction)
      }))
    };
    
    res.json(dashboardData);
    
  } catch (error) {
    console.error('Error fetching employee dashboard:', error);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

module.exports = {
  router,
  initializeAuth
};