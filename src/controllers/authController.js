app.post("/api/authenticate", async (req, res) => {
  try {
    const { employeeCode, password } = req.body;

    if (!employeeCode || !password) {
      return res.status(400).json({
        success: false,
        message: "Employee code and password are required",
      });
    }

    // Query to find employee by employee_id (employee code)
    console.log("Authenticating:", employeeCode, password);

    const [rows] = await db.query(
      "SELECT * FROM payrolls WHERE employee_id = ? LIMIT 1",
      [employeeCode]
    );

    console.log("Query result:", rows);

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid employee code or password",
      });
    }

    const employee = rows[0];

    // For now, we'll use a simple password check
    // In production, you should hash passwords and compare hashed values
    // For demo purposes, let's assume password should be "password123"
    // You can modify this logic based on your requirements

    if (password !== "password123") {
      return res.status(401).json({
        success: false,
        message: "Invalid employee code or password",
      });
    }

    // Calculate last salary (total of basic + overtime + bonus + allowances - deductions)
    const lastSalary =
      parseFloat(employee.basic_salary) +
      parseFloat(employee.overtime) +
      parseFloat(employee.bonus) +
      parseFloat(employee.allowances) -
      parseFloat(employee.leave_deduction) -
      parseFloat(employee.lop_deduction) -
      parseFloat(employee.late_deduction);

    // Return employee information (excluding sensitive data)
    const employeeInfo = {
      id: employee.id,
      name: employee.employee_name,
      employeeId: employee.employee_id,
      position: employee.position,
      department: employee.department,
      email: employee.employee_email,
      lastSalary: lastSalary,
    };

    res.json({
      success: true,
      message: "Authentication successful",
      employee: employeeInfo,
    });
  } catch (error) {
    console.error("❌ Full error stack:", error);
    res.status(500).json({
      success: false,
      message: "Server error during authentication",
    });
  }
});