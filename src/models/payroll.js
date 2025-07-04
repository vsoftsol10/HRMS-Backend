// routes/payroll.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// GET /api/payroll - Get all payroll records
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        employee_id,
        employee_name,
        position,
        department,
        email,
        pay_period_start,
        pay_period_end,
        pay_date,
        basic_salary,
        overtime,
        bonus,
        allowances,
        leave_deduction,
        lop_deduction,
        late_deduction,
        net_salary,
        created_at
      FROM payroll 
      ORDER BY created_at DESC
    `);
    
    // Transform to match your frontend format
    const payrolls = result.rows.map(row => ({
      id: row.id,
      payPeriod: {
        start: row.pay_period_start,
        end: row.pay_period_end,
        payDate: row.pay_date
      },
      company: {
        name: 'VSoft Solutions',
        address: 'Tirunelveli, TN, India',
        phone: '+91-9876543210',
        email: 'info@thevsoft.com'
      },
      employee: {
        name: row.employee_name,
        employeeId: row.employee_id,
        position: row.position,
        department: row.department,
        email: row.email
      },
      salary: {
        basicSalary: parseFloat(row.basic_salary),
        overtime: parseFloat(row.overtime),
        bonus: parseFloat(row.bonus),
        allowances: parseFloat(row.allowances)
      },
      deductions: {
        LeaveDeduction: parseFloat(row.leave_deduction),
        LOP_Deduction: parseFloat(row.lop_deduction),
        Late_Deduction: parseFloat(row.late_deduction)
      },
      netSalary: parseFloat(row.net_salary)
    }));
    
    res.json(payrolls);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ error: 'Failed to fetch payroll data' });
  }
});

// GET /api/payroll/:id - Get specific payroll record
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM payroll WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payroll not found' });
    }
    
    const row = result.rows[0];
    const payroll = {
      id: row.id,
      payPeriod: {
        start: row.pay_period_start,
        end: row.pay_period_end,
        payDate: row.pay_date
      },
      company: {
        name: 'VSoft Solutions',
        address: 'Tirunelveli, TN, India',
        phone: '+91-9876543210',
        email: 'info@thevsoft.com'
      },
      employee: {
        name: row.employee_name,
        employeeId: row.employee_id,
        position: row.position,
        department: row.department,
        email: row.email
      },
      salary: {
        basicSalary: parseFloat(row.basic_salary),
        overtime: parseFloat(row.overtime),
        bonus: parseFloat(row.bonus),
        allowances: parseFloat(row.allowances)
      },
      deductions: {
        LeaveDeduction: parseFloat(row.leave_deduction),
        LOP_Deduction: parseFloat(row.lop_deduction),
        Late_Deduction: parseFloat(row.late_deduction)
      },
      netSalary: parseFloat(row.net_salary)
    };
    
    res.json(payroll);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ error: 'Failed to fetch payroll data' });
  }
});

// POST /api/payroll - Create new payroll record
router.post('/', async (req, res) => {
  try {
    const { payPeriod, employee, salary, deductions } = req.body;
    
    const netSalary = (
      salary.basicSalary + salary.overtime + salary.bonus + salary.allowances
    ) - (
      deductions.LeaveDeduction + deductions.LOP_Deduction + deductions.Late_Deduction
    );
    
    const result = await pool.query(`
      INSERT INTO payroll (
        employee_id, employee_name, position, department, email,
        pay_period_start, pay_period_end, pay_date,
        basic_salary, overtime, bonus, allowances,
        leave_deduction, lop_deduction, late_deduction, net_salary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      employee.employeeId,
      employee.name,
      employee.position,
      employee.department,
      employee.email,
      payPeriod.start,
      payPeriod.end,
      payPeriod.payDate,
      salary.basicSalary,
      salary.overtime,
      salary.bonus,
      salary.allowances,
      deductions.LeaveDeduction,
      deductions.LOP_Deduction,
      deductions.Late_Deduction,
      netSalary
    ]);
    
    res.status(201).json({
      id: result.rows[0].id,
      payPeriod,
      company: {
        name: 'VSoft Solutions',
        address: 'Tirunelveli, TN, India',
        phone: '+91-9876543210',
        email: 'info@thevsoft.com'
      },
      employee,
      salary,
      deductions,
      netSalary
    });
  } catch (error) {
    console.error('Error creating payroll:', error);
    res.status(500).json({ error: 'Failed to create payroll record' });
  }
});

// PUT /api/payroll/:id - Update payroll record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { payPeriod, employee, salary, deductions } = req.body;
    
    const netSalary = (
      salary.basicSalary + salary.overtime + salary.bonus + salary.allowances
    ) - (
      deductions.LeaveDeduction + deductions.LOP_Deduction + deductions.Late_Deduction
    );
    
    const result = await pool.query(`
      UPDATE payroll SET
        employee_id = $2,
        employee_name = $3,
        position = $4,
        department = $5,
        email = $6,
        pay_period_start = $7,
        pay_period_end = $8,
        pay_date = $9,
        basic_salary = $10,
        overtime = $11,
        bonus = $12,
        allowances = $13,
        leave_deduction = $14,
        lop_deduction = $15,
        late_deduction = $16,
        net_salary = $17
      WHERE id = $1
      RETURNING *
    `, [
      id,
      employee.employeeId,
      employee.name,
      employee.position,
      employee.department,
      employee.email,
      payPeriod.start,
      payPeriod.end,
      payPeriod.payDate,
      salary.basicSalary,
      salary.overtime,
      salary.bonus,
      salary.allowances,
      deductions.LeaveDeduction,
      deductions.LOP_Deduction,
      deductions.Late_Deduction,
      netSalary
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payroll not found' });
    }
    
    res.json({
      id: parseInt(id),
      payPeriod,
      company: {
        name: 'VSoft Solutions',
        address: 'Tirunelveli, TN, India',
        phone: '+91-9876543210',
        email: 'info@thevsoft.com'
      },
      employee,
      salary,
      deductions,
      netSalary
    });
  } catch (error) {
    console.error('Error updating payroll:', error);
    res.status(500).json({ error: 'Failed to update payroll record' });
  }
});

// DELETE /api/payroll/:id - Delete payroll record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM payroll WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payroll not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting payroll:', error);
    res.status(500).json({ error: 'Failed to delete payroll record' });
  }
});

module.exports = router;