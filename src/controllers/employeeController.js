// Optional: Add endpoint to get employee dashboard data
app.get("/api/employee/:employeeId/dashboard", async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    // Get employee's payroll records
    const [payrollRows] = await db.query(
      "SELECT * FROM payrolls WHERE employee_id = ? ORDER BY created_at DESC",
      [employeeId]
    );

    if (payrollRows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const latestPayroll = payrollRows[0];

    // Calculate dashboard metrics
    const dashboardData = {
      employee: {
        name: latestPayroll.employee_name,
        employeeId: latestPayroll.employee_id,
        position: latestPayroll.position,
        department: latestPayroll.department,
        email: latestPayroll.employee_email,
      },
      payrollHistory: payrollRows.map((row) => ({
        id: row.id,
        payPeriod: {
          start: row.pay_period_start,
          end: row.pay_period_end,
          payDate: row.pay_date,
        },
        netSalary:
          parseFloat(row.basic_salary) +
          parseFloat(row.overtime) +
          parseFloat(row.bonus) +
          parseFloat(row.allowances) -
          parseFloat(row.leave_deduction) -
          parseFloat(row.lop_deduction) -
          parseFloat(row.late_deduction),
      })),
      summary: {
        totalPayrolls: payrollRows.length,
        averageSalary:
          payrollRows.reduce((sum, row) => {
            const netSalary =
              parseFloat(row.basic_salary) +
              parseFloat(row.overtime) +
              parseFloat(row.bonus) +
              parseFloat(row.allowances) -
              parseFloat(row.leave_deduction) -
              parseFloat(row.lop_deduction) -
              parseFloat(row.late_deduction);
            return sum + netSalary;
          }, 0) / payrollRows.length,
      },
    };

    res.json(dashboardData);
  } catch (error) {
    console.error("Error fetching employee dashboard:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
  }
});



// Employee Management - PostgreSQL Version

// GET - Fetch ALL EMPLOYEES
app.get("/api/employees", async (req, res) => {
  try {
    const query = `
      SELECT 
        e.*,
        d.name as department_name,
        p.title as position_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.status != 'terminated'
      ORDER BY e.created_at DESC
    `;

    console.log("Running employee fetch...");
    const result = await pool.query(query);
    console.log("Query successful. Row count:", result.rowCount);

    // Check if result.rows exists
    if (!result.rows) {
      console.error("result.rows is undefined");
      return res.status(500).json({ 
        message: "Database query returned unexpected format",
        error: "result.rows is undefined" 
      });
    }

    const employees = result.rows.map((row) => ({
      id: row.id,
      employeeCode: row.employee_code,
      fullName: `${row.first_name} ${row.middle_name ? row.middle_name + " " : ""}${row.last_name}`,
      firstName: row.first_name,
      middleName: row.middle_name,
      lastName: row.last_name,
      personalEmail: row.personal_email,
      phone: row.phone,
      alternatePhone: row.alternate_phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      maritalStatus: row.marital_status,
      nationality: row.nationality,
      religion: row.religion,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      emergencyContactRelationship: row.emergency_contact_relationship,
      departmentId: row.department_id,
      departmentName: row.department_name,
      positionId: row.position_id,
      positionTitle: row.position_title,
      managerId: row.manager_id,
      managerName: row.manager_name,
      hireDate: row.hire_date,
      probationEndDate: row.probation_end_date,
      confirmationDate: row.confirmation_date,
      employmentType: row.employment_type,
      workLocation: row.work_location,
      status: row.status,
      terminationDate: row.termination_date,
      terminationReason: row.termination_reason,
      profilePicture: row.profile_picture,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ 
      message: "Error fetching employees", 
      error: error.message,
      stack: error.stack // Add stack trace for debugging
    });
  }
});

// GET - Fetch single employee by ID
app.get("/api/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const query = `
      SELECT 
        e.*,
        d.name as department_name,
        p.title as position_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.id = $1
    `;

    const result = await pool.query(query, [id]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const row = rows[0];
    const employee = {
      id: row.id,
      employeeCode: row.employee_code,
      fullName: `${row.first_name} ${row.middle_name ? row.middle_name + " " : ""}${row.last_name}`,
      firstName: row.first_name,
      middleName: row.middle_name,
      lastName: row.last_name,
      personalEmail: row.personal_email,
      phone: row.phone,
      alternatePhone: row.alternate_phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      maritalStatus: row.marital_status,
      nationality: row.nationality,
      religion: row.religion,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      emergencyContactRelationship: row.emergency_contact_relationship,
      departmentId: row.department_id,
      departmentName: row.department_name,
      positionId: row.position_id,
      positionTitle: row.position_title,
      managerId: row.manager_id,
      managerName: row.manager_name,
      hireDate: row.hire_date,
      probationEndDate: row.probation_end_date,
      confirmationDate: row.confirmation_date,
      employmentType: row.employment_type,
      workLocation: row.work_location,
      status: row.status,
      terminationDate: row.termination_date,
      terminationReason: row.termination_reason,
      profilePicture: row.profile_picture,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ message: "Error fetching employee", error: error.message });
  }
});

// POST - Create new employee
app.post("/api/employees", async (req, res) => {
  try {
    const {
      employeeCode,
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      maritalStatus,
      nationality,
      religion,
      personalEmail,
      phone,
      alternatePhone,
      address,
      city,
      state,
      country,
      postalCode,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      departmentId,
      positionId,
      managerId,
      hireDate,
      probationEndDate,
      confirmationDate,
      employmentType,
      workLocation,
      status,
      notes,
    } = req.body;

    const insertQuery = `
      INSERT INTO employees (
        employee_code, first_name, middle_name, last_name, date_of_birth,
        gender, marital_status, nationality, religion, personal_email,
        phone, alternate_phone, address, city, state, country, postal_code,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        department_id, position_id, manager_id, hire_date, probation_end_date,
        confirmation_date, employment_type, work_location, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      RETURNING id
    `;

    const values = [
      employeeCode,
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      maritalStatus,
      nationality,
      religion,
      personalEmail,
      phone,
      alternatePhone,
      address,
      city,
      state,
      country || "India",
      postalCode,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      departmentId,
      positionId,
      managerId,
      hireDate,
      probationEndDate,
      confirmationDate,
      employmentType || "full-time",
      workLocation || "office",
      status || "active",
      notes,
    ];

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      message: "Employee created successfully",
      id: result.rows[0].id,
    });
  } catch (error) {
    console.error("Error creating employee:", error);
    if (error.code === "23505") { // PostgreSQL unique constraint violation
      res.status(400).json({ message: "Employee code already exists" });
    } else {
      res.status(500).json({ message: "Error creating employee", error: error.message });
    }
  }
});

// PUT - Update employee
app.put("/api/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    const {
      employeeCode,
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      maritalStatus,
      nationality,
      religion,
      personalEmail,
      phone,
      alternatePhone,
      address,
      city,
      state,
      country,
      postalCode,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      departmentId,
      positionId,
      managerId,
      hireDate,
      probationEndDate,
      confirmationDate,
      employmentType,
      workLocation,
      status,
      notes,
    } = req.body;

    // Format dates
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toISOString().split("T")[0]; // YYYY-MM-DD format
    };

    // Validation
    if (departmentId) {
      const deptCheck = await pool.query("SELECT id FROM departments WHERE id = $1", [departmentId]);
      if (deptCheck.rows.length === 0) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
    }

    if (positionId) {
      const posCheck = await pool.query("SELECT id FROM positions WHERE id = $1", [positionId]);
      if (posCheck.rows.length === 0) {
        return res.status(400).json({ message: "Invalid position ID" });
      }
    }

    const updateQuery = `
      UPDATE employees SET
        employee_code = $1, first_name = $2, middle_name = $3, last_name = $4,
        date_of_birth = $5, gender = $6, marital_status = $7, nationality = $8,
        religion = $9, personal_email = $10, phone = $11, alternate_phone = $12,
        address = $13, city = $14, state = $15, country = $16, postal_code = $17,
        emergency_contact_name = $18, emergency_contact_phone = $19, emergency_contact_relationship = $20,
        department_id = $21, position_id = $22, manager_id = $23, hire_date = $24,
        probation_end_date = $25, confirmation_date = $26, employment_type = $27,
        work_location = $28, status = $29, notes = $30,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $31
    `;

    const values = [
      employeeCode || null,
      firstName || null,
      middleName || null,
      lastName || null,
      formatDate(dateOfBirth),
      gender || null,
      maritalStatus || null,
      nationality || null,
      religion || null,
      personalEmail || null,
      phone || null,
      alternatePhone || null,
      address || null,
      city || null,
      state || null,
      country || null,
      postalCode || null,
      emergencyContactName || null,
      emergencyContactPhone || null,
      emergencyContactRelationship || null,
      departmentId || null,
      positionId || null,
      managerId || null,
      formatDate(hireDate),
      formatDate(probationEndDate),
      formatDate(confirmationDate),
      employmentType || null,
      workLocation || null,
      status || null,
      notes || null,
      id,
    ];

    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee updated successfully" });
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({
      message: "Error updating employee",
      error: error.message,
    });
  }
});

// DELETE - Delete employee
app.delete("/api/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const result = await pool.query("DELETE FROM employees WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ message: "Error deleting employee", error: error.message });
  }
});


// GET API - Fetch employee profile by employee code (for MyProfile component)
app.get("/api/profile/:employeeCode", async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;

    const query = `
      SELECT 
        e.*,
        d.name as department_name,
        p.title as position_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.employee_code = ? AND e.status != 'terminated'
    `;

    const [rows] = await db.query(query, [employeeCode]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const row = rows[0];

    // Calculate age
    const calculateAge = (birthDate) => {
      if (!birthDate) return 0;
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        age--;
      }
      return age;
    };

    // Calculate years of service
    const calculateYearsOfService = (hireDate) => {
      if (!hireDate) return 0;
      const today = new Date();
      const hire = new Date(hireDate);
      const diffTime = Math.abs(today - hire);
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
      return Math.round(diffYears * 10) / 10; // Round to 1 decimal place
    };

    // Format the employee data to match your MyProfile component structure
    const profileData = {
      // Personal Information
      fullName: `${row.first_name} ${
        row.middle_name ? row.middle_name + " " : ""
      }${row.last_name}`,
      employeeId: row.employee_code,
      profilePhoto: row.profile_picture || "/api/placeholder/150/150",
      dateOfBirth: row.date_of_birth
        ? row.date_of_birth.toISOString().split("T")[0]
        : "",
      age: calculateAge(row.date_of_birth),
      gender: row.gender || "",
      maritalStatus: row.marital_status || "",
      nationality: row.nationality || "",
      personalEmail: row.personal_email || "",
      phoneNumber: row.phone || "",
      alternatePhone: row.alternate_phone || "",
      currentAddress: row.address || "",
      permanentAddress: row.address || "", // Using same address for both

      // Emergency Contact
      emergencyContactName: row.emergency_contact_name || "",
      emergencyContactRelation: row.emergency_contact_relationship || "",
      emergencyContactPhone: row.emergency_contact_phone || "",
      emergencyContactEmail: "", // Not in your current schema

      // Professional Information
      jobTitle: row.position_title || "",
      department: row.department_name || "",
      employeeType: row.employment_type || "",
      dateOfJoining: row.hire_date
        ? row.hire_date.toISOString().split("T")[0]
        : "",
      yearsOfService: calculateYearsOfService(row.hire_date),
      reportingManager: row.manager_name || "",
      workLocation: row.work_location || "",
      employeeStatus: row.status || "Active",

      // Employment Details (You might need to add these to employees table or fetch from payroll)
      currentSalary: "$0", // You'll need to fetch this from payroll table
      workSchedule: "Monday - Friday, 9:00 AM - 6:00 PM", // Default value
      benefits: [
        "Health Insurance",
        "Dental Coverage",
        "401(k)",
        "Paid Time Off",
      ], // Default values
    };

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching employee profile:", error);
    res
      .status(500)
      .json({ message: "Error fetching profile", error: error.message });
  }
});

// PUT API - Update employee profile
app.put("/api/profile/:employeeCode", async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;
    const profileData = req.body;

    // Split full name into parts (basic implementation)
    const nameParts = profileData.fullName.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts[nameParts.length - 1] || "";
    const middleName =
      nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

    const updateQuery = `
      UPDATE employees SET
        first_name = ?, middle_name = ?, last_name = ?,
        date_of_birth = ?, gender = ?, marital_status = ?, nationality = ?,
        personal_email = ?, phone = ?, alternate_phone = ?, address = ?,
        emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relationship = ?
      WHERE employee_code = ?
    `;

    const values = [
      firstName,
      middleName || null,
      lastName,
      profileData.dateOfBirth || null,
      profileData.gender || null,
      profileData.maritalStatus || null,
      profileData.nationality || null,
      profileData.personalEmail || null,
      profileData.phoneNumber || null,
      profileData.alternatePhone || null,
      profileData.currentAddress || null,
      profileData.emergencyContactName || null,
      profileData.emergencyContactPhone || null,
      profileData.emergencyContactRelation || null,
      employeeCode,
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ message: "Error updating profile", error: error.message });
  }
});