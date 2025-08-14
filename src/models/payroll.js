class Payroll {
  constructor(data) {
    this.id = data.id;
    this.payPeriod = data.payPeriod;
    this.company = data.company;
    this.employee = data.employee;
    this.salary = data.salary;
    this.deductions = data.deductions;
  }

  static fromDatabase(row) {
    return {
      id: row.id,
      payPeriod: {
        start: row.pay_period_start,
        end: row.pay_period_end,
        payDate: row.pay_date,
      },
      company: {
        name: row.company_name,
        address: row.company_address,
        phone: row.company_phone,
        email: row.company_email,
      },
      employee: {
        name: row.employee_name,
        employeeId: row.employee_id,
        position: row.position,
        department: row.department,
        email: row.employee_email,
      },
      salary: {
        basicSalary: parseFloat(row.basic_salary),
        overtime: parseFloat(row.overtime),
        bonus: parseFloat(row.bonus),
        allowances: parseFloat(row.allowances),
      },
      deductions: {
        LeaveDeduction: parseFloat(row.leave_deduction),
        LOP_Deduction: parseFloat(row.lop_deduction),
        Late_Deduction: parseFloat(row.late_deduction),
      },
    };
  }

  toDatabase() {
    return {
      pay_period_start: this.payPeriod.start,
      pay_period_end: this.payPeriod.end,
      pay_date: this.payPeriod.payDate,
      company_name: this.company.name,
      company_address: this.company.address,
      company_phone: this.company.phone,
      company_email: this.company.email,
      employee_name: this.employee.name,
      employee_id: this.employee.employeeId,
      position: this.employee.position,
      department: this.employee.department,
      employee_email: this.employee.email,
      basic_salary: this.salary.basicSalary,
      overtime: this.salary.overtime,
      bonus: this.salary.bonus,
      allowances: this.salary.allowances,
      leave_deduction: this.deductions.LeaveDeduction,
      lop_deduction: this.deductions.LOP_Deduction,
      late_deduction: this.deductions.Late_Deduction,
    };
  }
}

module.exports = Payroll;