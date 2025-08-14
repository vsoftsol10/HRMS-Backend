const db = require('../../config/database');
const Payroll = require('../../models/payroll');

class PayrollService {
  static async getAllPayrolls() {
    const result = await db.query(
      "SELECT * FROM payrolls ORDER BY created_at DESC"
    );
    
    return result.rows.map(row => Payroll.fromDatabase(row));
  }

  static async getPayrollById(id) {
    const result = await db.query("SELECT * FROM payrolls WHERE id = $1", [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return Payroll.fromDatabase(result.rows[0]);
  }

  static async createPayroll(payrollData) {
    const { payPeriod, company, employee, salary, deductions } = payrollData;

    const insertQuery = `
      INSERT INTO payrolls (
        pay_period_start, pay_period_end, pay_date,
        company_name, company_address, company_phone, company_email,
        employee_name, employee_id, position, department, employee_email,
        basic_salary, overtime, bonus, allowances,
        leave_deduction, lop_deduction, late_deduction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id
    `;

    const values = [
      payPeriod.start, payPeriod.end, payPeriod.payDate,
      company.name, company.address, company.phone, company.email,
      employee.name, employee.employeeId, employee.position, employee.department, employee.email,
      salary.basicSalary, salary.overtime, salary.bonus, salary.allowances,
      deductions.LeaveDeduction, deductions.LOP_Deduction, deductions.Late_Deduction
    ];

    const result = await db.query(insertQuery, values);
    const insertId = result.rows[0].id;

    const newPayrollResult = await db.query(
      "SELECT * FROM payrolls WHERE id = $1",
      [insertId]
    );

    return {
      id: insertId,
      payroll: newPayrollResult.rows[0]
    };
  }

  static async updatePayroll(id, payrollData) {
    const { payPeriod, company, employee, salary, deductions } = payrollData;

    const updateQuery = `
      UPDATE payrolls SET
        pay_period_start = $1, pay_period_end = $2, pay_date = $3,
        company_name = $4, company_address = $5, company_phone = $6, company_email = $7,
        employee_name = $8, employee_id = $9, position = $10, department = $11, employee_email = $12,
        basic_salary = $13, overtime = $14, bonus = $15, allowances = $16,
        leave_deduction = $17, lop_deduction = $18, late_deduction = $19
      WHERE id = $20
    `;

    const values = [
      payPeriod.start, payPeriod.end, payPeriod.payDate,
      company.name, company.address, company.phone, company.email,
      employee.name, employee.employeeId, employee.position, employee.department, employee.email,
      salary.basicSalary, salary.overtime, salary.bonus, salary.allowances,
      deductions.LeaveDeduction, deductions.LOP_Deduction, deductions.Late_Deduction,
      id
    ];

    const result = await db.query(updateQuery, values);

    if (result.rowCount === 0) {
      return null;
    }

    const updatedPayrollResult = await db.query(
      "SELECT * FROM payrolls WHERE id = $1",
      [id]
    );

    return updatedPayrollResult.rows[0];
  }

  static async deletePayroll(id) {
    const result = await db.query("DELETE FROM payrolls WHERE id = $1", [id]);
    return result.rowCount > 0;
  }
}

module.exports = PayrollService;