// GET API - Fetch all payrolls
app.get("/api/payroll", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM payrolls ORDER BY created_at DESC"
    );

    // Transform database rows to match frontend expected format
    const payrolls = rows.map((row) => ({
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
    }));

    res.json(payrolls);
  } catch (error) {
    console.error("Error fetching payrolls:", error);
    res
      .status(500)
      .json({ message: "Error fetching payrolls", error: error.message });
  }
});

// GET API - Fetch single payroll by ID
app.get("/api/payroll/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await db.query("SELECT * FROM payrolls WHERE id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    const row = rows[0];
    const payroll = {
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

    res.json(payroll);
  } catch (error) {
    console.error("Error fetching payroll:", error);
    res
      .status(500)
      .json({ message: "Error fetching payroll", error: error.message });
  }
});

// POST API - Create new payroll
app.post("/api/payroll", async (req, res) => {
  try {
    const { payPeriod, company, employee, salary, deductions } = req.body;

    const insertQuery = `
      INSERT INTO payrolls (
        pay_period_start, pay_period_end, pay_date,
        company_name, company_address, company_phone, company_email,
        employee_name, employee_id, position, department, employee_email,
        basic_salary, overtime, bonus, allowances,
        leave_deduction, lop_deduction, late_deduction
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      payPeriod.start,
      payPeriod.end,
      payPeriod.payDate,
      company.name,
      company.address,
      company.phone,
      company.email,
      employee.name,
      employee.employeeId,
      employee.position,
      employee.department,
      employee.email,
      salary.basicSalary,
      salary.overtime,
      salary.bonus,
      salary.allowances,
      deductions.LeaveDeduction,
      deductions.LOP_Deduction,
      deductions.Late_Deduction,
    ];

    const [result] = await db.query(insertQuery, values);

    // Fetch the created payroll to return
    const [newPayroll] = await db.query(
      "SELECT * FROM payrolls WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      message: "Payroll created successfully",
      id: result.insertId,
      payroll: newPayroll[0],
    });
  } catch (error) {
    console.error("Error creating payroll:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(400).json({ message: "Employee ID already exists" });
    } else {
      res
        .status(500)
        .json({ message: "Error creating payroll", error: error.message });
    }
  }
});

// PUT API - Update payroll
app.put("/api/payroll/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { payPeriod, company, employee, salary, deductions } = req.body;

    const updateQuery = `
      UPDATE payrolls SET
        pay_period_start = ?, pay_period_end = ?, pay_date = ?,
        company_name = ?, company_address = ?, company_phone = ?, company_email = ?,
        employee_name = ?, employee_id = ?, position = ?, department = ?, employee_email = ?,
        basic_salary = ?, overtime = ?, bonus = ?, allowances = ?,
        leave_deduction = ?, lop_deduction = ?, late_deduction = ?
      WHERE id = ?
    `;

    const values = [
      payPeriod.start,
      payPeriod.end,
      payPeriod.payDate,
      company.name,
      company.address,
      company.phone,
      company.email,
      employee.name,
      employee.employeeId,
      employee.position,
      employee.department,
      employee.email,
      salary.basicSalary,
      salary.overtime,
      salary.bonus,
      salary.allowances,
      deductions.LeaveDeduction,
      deductions.LOP_Deduction,
      deductions.Late_Deduction,
      id,
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    // Fetch updated payroll
    const [updatedPayroll] = await db.query(
      "SELECT * FROM payrolls WHERE id = ?",
      [id]
    );

    res.json({
      message: "Payroll updated successfully",
      payroll: updatedPayroll[0],
    });
  } catch (error) {
    console.error("Error updating payroll:", error);
    res
      .status(500)
      .json({ message: "Error updating payroll", error: error.message });
  }
});

// DELETE API - Delete payroll
app.delete("/api/payroll/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [result] = await db.query("DELETE FROM payrolls WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    res.status(200).json({ message: "Payroll deleted successfully" });
  } catch (error) {
    console.error("Error deleting payroll:", error);
    res
      .status(500)
      .json({ message: "Error deleting payroll", error: error.message });
  }
});