require("dotenv").config();
const { Pool } = require('pg');
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const db = require('./src/config/database'); // PostgreSQL connection
const adminRoutes = require('./src/routes/adminIntern/index');
const multer = require('multer');


const PORT = process.env.PORT || 8080;
const app = express();

// ✅ CRITICAL: Trust proxy for deployment platforms (Render, Heroku, etc.)
app.set('trust proxy', 1);


const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://portal.thevsoft.com'
];

// 🔥 SIMPLIFIED CORS Configuration - sometimes complex configs fail
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🌍 CORS Check - Request from origin:', origin);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://portal.thevsoft.com'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS: Origin blocked:', origin);
      callback(null, true); // 🔥 TEMPORARILY ALLOW ALL for debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ],
  optionsSuccessStatus: 200
};

// ✅ Middleware in correct order
app.use(cors(corsOptions));


app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(helmet());

// ✅ Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true // Important for deployment platforms
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// ✅ Single console.log statement
console.log("✅ CORS middleware initialized with allowed origins:", allowedOrigins);



// Middleware to verify JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log('🔍 Auth middleware:', { 
    path: req.path,
    method: req.method,
    hasAuthHeader: !!authHeader, 
    hasToken: !!token
  });

  if (!token) {
    console.log('❌ No token provided for:', req.path);
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    
    // Handle both userId and id formats
    if (decoded.userId && !decoded.id) {
      decoded.id = decoded.userId;
    }
    
    req.user = decoded;
    console.log('✅ Token valid for user:', req.user.id);
    next();
  } catch (error) {
    console.error('❌ JWT verification failed:', error.message);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Debug CORS route
app.get('/api/cors-debug', (req, res) => {
  res.json({
    origin: req.headers.origin,
    headers: req.headers,
    method: req.method,
    url: req.url,
    allowedOrigins: allowedOrigins
  });
});
app.options('*', (req, res) => {
  console.log('🚀 Preflight OPTIONS request from:', req.headers.origin);
  
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    
    console.log('✅ Preflight response sent with origin:', origin);
    res.sendStatus(200);
  } else {
    console.log('❌ Preflight blocked for origin:', origin);
    res.sendStatus(403);
  }
});

// CORS TEST
app.get('/api/cors-test', (req, res) => {
  console.log('🔍 CORS test accessed from:', req.headers.origin);
  res.json({ 
    success: true, 
    message: 'CORS test successful',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// PostgreSQL Test Route
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ message: '✅ PostgreSQL connected', time: result.rows[0].now });
  } catch (err) {
    console.error('❌ PostgreSQL query error:', err.message);
    res.status(500).json({ error: 'DB Query Failed' });
  }
});

// Add this route for immediate testing
app.get('/api/test', (req, res) => {
  console.log('✅ Test route accessed successfully');
  res.json({ 
    message: 'Backend server is working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ Enhanced Global Error Handler
app.use((err, req, res, next) => {
  // Handle CORS errors
  if (err.message && err.message.includes("CORS: Origin")) {
    return res.status(403).json({
      success: false,
      message: "CORS Error: This origin is not allowed."
    });
  }
  
  // Handle rate limit errors
  if (err.code === 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR') {
    console.warn("Rate limit proxy warning (handled):", err.message);
    return next();
  }
  
  // Generic error handler
  console.error("Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// Create payrolls table if it doesn't exist
async function initializeDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS payrolls (
        id SERIAL PRIMARY KEY,
        pay_period_start DATE NOT NULL,
        pay_period_end DATE NOT NULL,
        pay_date DATE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        company_address TEXT,
        company_phone VARCHAR(20),
        company_email VARCHAR(255),
        employee_name VARCHAR(255) NOT NULL,
        employee_id VARCHAR(50) NOT NULL UNIQUE,
        position VARCHAR(255),
        department VARCHAR(255),
        employee_email VARCHAR(255),
        basic_salary DECIMAL(10,2) DEFAULT 0,
        overtime DECIMAL(10,2) DEFAULT 0,
        bonus DECIMAL(10,2) DEFAULT 0,
        allowances DECIMAL(10,2) DEFAULT 0,
        leave_deduction DECIMAL(10,2) DEFAULT 0,
        lop_deduction DECIMAL(10,2) DEFAULT 0,
        late_deduction DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await db.query(createTableQuery);
    console.log("✅ Payrolls table created/verified successfully!");
  } catch (error) {
    console.error("❌ Error creating table:", error.message);
  }
}

// Initialize database
initializeDatabase();

// Root route - API Status endpoint
app.get("/", (req, res) => {
  res.json({
    message: "VSOFT HRMS API Server is running successfully!",
    status: "active",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      "GET /api/payroll - Fetch all payrolls",
      "GET /api/payroll/:id - Fetch single payroll",
      "POST /api/payroll - Create new payroll",
      "PUT /api/payroll/:id - Update payroll",
      "DELETE /api/payroll/:id - Delete payroll",
      "POST /api/authenticate - Employee authentication",
      "GET /api/employee/:employeeId/dashboard - Employee dashboard",
      "GET /api/employees - Fetch all employees",
      "GET /api/employees/:id - Fetch single employee",
      "POST /api/employees - Create new employee",
      "PUT /api/employees/:id - Update employee",
      "DELETE /api/employees/:id - Delete employee",
      "GET /api/departments - Fetch departments",
      "GET /api/positions - Fetch positions",
      "GET /api/managers - Fetch managers",
      "GET /api/profile/:employeeCode - Fetch employee profile",
      "PUT /api/profile/:employeeCode - Update employee profile",
    ],
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "VSOFT HRMS API",
    version: "1.0.0",
    documentation: "API endpoints for HRMS system",
    base_url: req.protocol + "://" + req.get("host"),
  });
});



// GET API - Fetch all payrolls
app.get("/api/payroll", async (req, res) => {
  try {
    // PostgreSQL - remove array destructuring, use .rows property
    const result = await db.query(
      "SELECT * FROM payrolls ORDER BY created_at DESC"
    );
    const rows = result.rows; // PostgreSQL returns { rows: [...] }

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
    const result = await db.query("SELECT * FROM payrolls WHERE id = $1", [
      id,
    ]);
    const rows = result.rows;

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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id
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

    const result = await db.query(insertQuery, values);
    const insertId = result.rows[0].id;

    // Fetch the created payroll to return
    const newPayrollResult = await db.query(
      "SELECT * FROM payrolls WHERE id = $1",
      [insertId]
    );

    res.status(201).json({
      message: "Payroll created successfully",
      id: insertId,
      payroll: newPayrollResult.rows[0],
    });
  } catch (error) {
    console.error("Error creating payroll:", error);
    if (error.code === "23505") { // PostgreSQL unique violation code
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
        pay_period_start = $1, pay_period_end = $2, pay_date = $3,
        company_name = $4, company_address = $5, company_phone = $6, company_email = $7,
        employee_name = $8, employee_id = $9, position = $10, department = $11, employee_email = $12,
        basic_salary = $13, overtime = $14, bonus = $15, allowances = $16,
        leave_deduction = $17, lop_deduction = $18, late_deduction = $19
      WHERE id = $20
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

    const result = await db.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    // Fetch updated payroll
    const updatedPayrollResult = await db.query(
      "SELECT * FROM payrolls WHERE id = $1",
      [id]
    );

    res.json({
      message: "Payroll updated successfully",
      payroll: updatedPayrollResult.rows[0],
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

    const result = await db.query("DELETE FROM payrolls WHERE id = $1", [
      id,
    ]);

    if (result.rowCount === 0) {
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


//Authentication

// Add this authentication endpoint to your existing backend code

app.post("/api/authenticate", async (req, res) => {
  try {
    const { employeeCode, password } = req.body;

    if (!employeeCode || !password) {
      return res.status(400).json({
        success: false,
        message: "Employee code and password are required",
      });
    }

    console.log("Authenticating:", employeeCode, password);

    // ✅ Use $1 parameter placeholder for PostgreSQL
    const result = await db.query(
      "SELECT * FROM payrolls WHERE employee_id = $1 LIMIT 1",
      [employeeCode]
    );

    console.log("Query result:", result.rows);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid employee code or password",
      });
    }

    const employee = result.rows[0];

    // ✅ Password check (hardcoded for demo)
    if (password !== "password123") {
      return res.status(401).json({
        success: false,
        message: "Invalid employee code or password",
      });
    }

    // ✅ Compute last salary
    const lastSalary =
      parseFloat(employee.basic_salary) +
      parseFloat(employee.overtime) +
      parseFloat(employee.bonus) +
      parseFloat(employee.allowances) -
      parseFloat(employee.leave_deduction) -
      parseFloat(employee.lop_deduction) -
      parseFloat(employee.late_deduction);

    // ✅ Employee info to return
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

    const result = await db.query(query);

    // Ensure result.rows is an array
    if (!Array.isArray(result.rows)) {
      return res.status(500).json({
        message: "Unexpected response format",
        error: "result.rows is not iterable",
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

    const result = await db.query(query, [id]);
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

    const result = await db.query(insertQuery, values);

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
      const deptCheck = await db.query("SELECT id FROM departments WHERE id = $1", [departmentId]);
      if (deptCheck.rows.length === 0) {
        return res.status(400).json({ message: "Invalid department ID" });
      }
    }

    if (positionId) {
      const posCheck = await db.query("SELECT id FROM positions WHERE id = $1", [positionId]);
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

    const result = await db.query(updateQuery, values);

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

    const result = await db.query("DELETE FROM employees WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ message: "Error deleting employee", error: error.message });
  }
});



// GET API - Fetch departments for dropdown
app.get("/api/departments", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name FROM departments ORDER BY name"
    );
    res.json(result.rows); // Use result.rows for PostgreSQL
  } catch (error) {
    console.error("Error fetching departments:", error);
    res
      .status(500)
      .json({ message: "Error fetching departments", error: error.message });
  }
});

// GET API - Fetch positions for dropdown
app.get("/api/positions", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, title FROM positions ORDER BY title"
    );
    res.json(result.rows); // Use result.rows for PostgreSQL
  } catch (error) {
    console.error("Error fetching positions:", error);
    res
      .status(500)
      .json({ message: "Error fetching positions", error: error.message });
  }
});

// GET API - Fetch managers for dropdown (active employees only)
app.get("/api/managers", async (req, res) => {
  try {
    const query = `
      SELECT id, CONCAT(first_name, ' ', last_name) as name 
      FROM employees 
      WHERE status = 'active' 
      ORDER BY first_name, last_name
    `;
    const result = await db.query(query);
    res.json(result.rows); // Use result.rows for PostgreSQL
  } catch (error) {
    console.error("Error fetching managers:", error);
    res
      .status(500)
      .json({ message: "Error fetching managers", error: error.message });
  }
});


// Add this endpoint to your existing backend code

// GET API - Fetch employee profile by employee code (for MyProfile component)
app.get("/api/profile/:employeeCode", async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;

    const query = `
      SELECT 
        e.*,
        d.name AS department_name,
        p.title AS position_title,
        CONCAT(m.first_name, ' ', m.last_name) AS manager_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.employee_code = $1 AND e.status != 'terminated'
    `;

    const result = await db.query(query, [employeeCode]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const row = result.rows[0];

    const calculateAge = (birthDate) => {
      if (!birthDate) return 0;
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    };

    const calculateYearsOfService = (hireDate) => {
      if (!hireDate) return 0;
      const today = new Date();
      const hire = new Date(hireDate);
      const diffTime = Math.abs(today - hire);
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
      return Math.round(diffYears * 10) / 10;
    };

    const profileData = {
      fullName: `${row.first_name} ${row.middle_name ? row.middle_name + " " : ""}${row.last_name}`,
      employeeId: row.employee_code,
      profilePhoto: row.profile_picture || "/api/placeholder/150/150",
      dateOfBirth: row.date_of_birth ? row.date_of_birth.toISOString().split("T")[0] : "",
      age: calculateAge(row.date_of_birth),
      gender: row.gender || "",
      maritalStatus: row.marital_status || "",
      nationality: row.nationality || "",
      personalEmail: row.personal_email || "",
      phoneNumber: row.phone || "",
      alternatePhone: row.alternate_phone || "",
      currentAddress: row.address || "",
      permanentAddress: row.address || "",

      emergencyContactName: row.emergency_contact_name || "",
      emergencyContactRelation: row.emergency_contact_relationship || "",
      emergencyContactPhone: row.emergency_contact_phone || "",
      emergencyContactEmail: "",

      jobTitle: row.position_title || "",
      department: row.department_name || "",
      employeeType: row.employment_type || "",
      dateOfJoining: row.hire_date ? row.hire_date.toISOString().split("T")[0] : "",
      yearsOfService: calculateYearsOfService(row.hire_date),
      reportingManager: row.manager_name || "",
      workLocation: row.work_location || "",
      employeeStatus: row.status || "Active",

      currentSalary: "$0",
      workSchedule: "Monday - Friday, 9:00 AM - 6:00 PM",
      benefits: ["Health Insurance", "Dental Coverage", "401(k)", "Paid Time Off"],
    };

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching employee profile:", error);
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
});


// PUT API - Update employee profile
app.put("/api/profile/:employeeCode", async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;
    const profileData = req.body;

    const nameParts = profileData.fullName.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts[nameParts.length - 1] || "";
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

    const updateQuery = `
      UPDATE employees SET
        first_name = $1,
        middle_name = $2,
        last_name = $3,
        date_of_birth = $4,
        gender = $5,
        marital_status = $6,
        nationality = $7,
        personal_email = $8,
        phone = $9,
        alternate_phone = $10,
        address = $11,
        emergency_contact_name = $12,
        emergency_contact_phone = $13,
        emergency_contact_relationship = $14
      WHERE employee_code = $15
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

    const result = await db.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
});


// Attendance API Routes

// Add these attendance API routes to your existing server.js file

// Helper function to calculate total hours from clock_in and clock_out
function calculateTotalHours(
  clockIn,
  clockOut,
  breakStart = null,
  breakEnd = null
) {
  if (!clockIn || !clockOut) return 0;

  const [inHours, inMinutes] = clockIn.split(":").map(Number);
  const [outHours, outMinutes] = clockOut.split(":").map(Number);

  const clockInMinutes = inHours * 60 + inMinutes;
  const clockOutMinutes = outHours * 60 + outMinutes;

  let totalMinutes = clockOutMinutes - clockInMinutes;

  // Subtract break time if provided
  if (breakStart && breakEnd) {
    const [breakStartHours, breakStartMinutes] = breakStart
      .split(":")
      .map(Number);
    const [breakEndHours, breakEndMinutes] = breakEnd.split(":").map(Number);

    const breakStartMin = breakStartHours * 60 + breakStartMinutes;
    const breakEndMin = breakEndHours * 60 + breakEndMinutes;

    const breakDuration = breakEndMin - breakStartMin;
    totalMinutes -= breakDuration;
  }

  return Math.max(0, totalMinutes / 60);
}

// Create attendance table if it doesn't exist
async function initializeAttendanceTable() {
  try {
    const createTableQuery = `
     -- First, create the ENUM type for status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half-day', 'sick', 'leave');
  END IF;
END$$;

-- Now create the table
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  clock_in TIME,
  clock_out TIME,
  break_start TIME,
  break_end TIME,
  total_hours DECIMAL(4,2) DEFAULT 0,
  break_hours DECIMAL(4,2) DEFAULT 0,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  late_minutes INT DEFAULT 0,
  early_leaving_minutes INT DEFAULT 0,
  status attendance_status DEFAULT 'present',
  work_from_home BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  notes TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
);

-- Add index separately (PostgreSQL style)
CREATE INDEX IF NOT EXISTS idx_employee_date ON attendance (employee_id, date);

    `;

    await db.query(createTableQuery);
    console.log("✅ Attendance table created/verified successfully!");
  } catch (error) {
    console.error("❌ Error creating attendance table:", error.message);
  }
}

// Call this function after your existing initializeDatabase() call
// initializeAttendanceTable();

// ATTENDANCE API ROUTES

// Get attendance data for a specific month and employee
app.get("/api/attendance/:employeeId/:year/:month", async (req, res) => {
  try {
    const { employeeId, year, month } = req.params;

    const query = `
      SELECT 
        id,
        date,
        clock_in,
        clock_out,
        break_start,
        break_end,
        total_hours,
        break_hours,
        overtime_hours,
        late_minutes,
        early_leaving_minutes,
        status,
        work_from_home,
        location,
        notes,
        is_approved
      FROM attendance 
      WHERE employee_id = ? 
        AND YEAR(date) = ? 
        AND MONTH(date) = ?
      ORDER BY date
    `;

    const [rows] = await db.query(query, [employeeId, year, month]);

    // Convert rows to object with date as key
    const attendanceData = {};
    rows.forEach((row) => {
      const dateKey = row.date.toISOString().split("T")[0];
      attendanceData[dateKey] = {
        id: row.id,
        clockIn: row.clock_in,
        clockOut: row.clock_out,
        breakStart: row.break_start,
        breakEnd: row.break_end,
        totalHours: parseFloat(row.total_hours || 0),
        breakHours: parseFloat(row.break_hours || 0),
        overtimeHours: parseFloat(row.overtime_hours || 0),
        lateMinutes: row.late_minutes || 0,
        earlyLeavingMinutes: row.early_leaving_minutes || 0,
        status: row.status,
        workFromHome: row.work_from_home,
        location: row.location,
        notes: row.notes,
        isApproved: row.is_approved,
      };
    });

    res.json({
      success: true,
      data: attendanceData,
    });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance data",
      error: error.message,
    });
  }
});

// Create or update attendance record
app.post("/api/attendance", async (req, res) => {
  try {
    const {
      employeeId,
      date,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      status = "present",
      workFromHome = false,
      location,
      notes,
    } = req.body;

    // Calculate total hours
    const totalHours = calculateTotalHours(
      clockIn,
      clockOut,
      breakStart,
      breakEnd
    );

    // Calculate break hours
    let breakHours = 0;
    if (breakStart && breakEnd) {
      breakHours = calculateTotalHours(breakStart, breakEnd);
    }

    const query = `
      INSERT INTO attendance (
        employee_id, date, clock_in, clock_out, break_start, break_end,
        total_hours, break_hours, status, work_from_home, location, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        clock_in = VALUES(clock_in),
        clock_out = VALUES(clock_out),
        break_start = VALUES(break_start),
        break_end = VALUES(break_end),
        total_hours = VALUES(total_hours),
        break_hours = VALUES(break_hours),
        status = VALUES(status),
        work_from_home = VALUES(work_from_home),
        location = VALUES(location),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await db.query(query, [
      employeeId,
      date,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      totalHours,
      breakHours,
      status,
      workFromHome,
      location,
      notes,
    ]);

    res.json({
      success: true,
      message: "Attendance record saved successfully",
      data: {
        id: result.insertId || result.affectedRows,
        totalHours,
      },
    });
  } catch (error) {
    console.error("Error saving attendance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save attendance record",
      error: error.message,
    });
  }
});

// Update attendance record by ID
app.put("/api/attendance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      status,
      workFromHome,
      location,
      notes,
    } = req.body;

    // Calculate total hours
    const totalHours = calculateTotalHours(
      clockIn,
      clockOut,
      breakStart,
      breakEnd
    );

    // Calculate break hours
    let breakHours = 0;
    if (breakStart && breakEnd) {
      breakHours = calculateTotalHours(breakStart, breakEnd);
    }

    const query = `
      UPDATE attendance SET
        clock_in = ?,
        clock_out = ?,
        break_start = ?,
        break_end = ?,
        total_hours = ?,
        break_hours = ?,
        status = ?,
        work_from_home = ?,
        location = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const [result] = await db.query(query, [
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      totalHours,
      breakHours,
      status,
      workFromHome,
      location,
      notes,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      message: "Attendance record updated successfully",
      data: { totalHours },
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update attendance record",
      error: error.message,
    });
  }
});

// Delete attendance record
app.delete("/api/attendance/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = "DELETE FROM attendance WHERE id = ?";
    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete attendance record",
      error: error.message,
    });
  }
});

// Get monthly summary
app.get(
  "/api/attendance/summary/:employeeId/:year/:month",
  async (req, res) => {
    try {
      const { employeeId, year, month } = req.params;

      const query = `
      SELECT 
        COUNT(*) as total_days,
        SUM(total_hours) as total_hours,
        AVG(total_hours) as average_hours,
        SUM(CASE WHEN total_hours >= 9 THEN 1 ELSE 0 END) as complete_days,
        SUM(CASE WHEN total_hours > 0 AND total_hours < 9 THEN 1 ELSE 0 END) as insufficient_days,
        SUM(overtime_hours) as total_overtime,
        SUM(late_minutes) as total_late_minutes
      FROM attendance 
      WHERE employee_id = ? 
        AND YEAR(date) = ? 
        AND MONTH(date) = ?
        AND status IN ('present', 'late', 'half-day')
    `;

      const [rows] = await db.query(query, [employeeId, year, month]);
      const summary = rows[0];

      res.json({
        success: true,
        data: {
          totalDays: summary.total_days || 0,
          totalHours: parseFloat(summary.total_hours || 0),
          averageHours: parseFloat(summary.average_hours || 0),
          completeDays: summary.complete_days || 0,
          insufficientDays: summary.insufficient_days || 0,
          totalOvertime: parseFloat(summary.total_overtime || 0),
          totalLateMinutes: summary.total_late_minutes || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch summary data",
        error: error.message,
      });
    }
  }
);

// Get all employees for attendance (simplified version of your existing employees endpoint)
app.get("/api/attendance/employees", async (req, res) => {
  try {
    const query = `
      SELECT 
        employee_code as id, 
        CONCAT(first_name, ' ', last_name) as name,
        first_name, 
        last_name, 
        personal_email as email 
      FROM employees 
      WHERE status = 'active'
      ORDER BY first_name, last_name
    `;
    const [rows] = await db.query(query);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching employees for attendance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message,
    });
  }
});

// Geofencing Backend API Extensions
// Add these to your existing server.js file

// Create geofencing-related tables
async function initializeGeofencingTables() {
  try {
    // Work locations table
    const createLocationsTable = `
      CREATE TABLE IF NOT EXISTS work_locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_meters INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

    `;

    // Update attendance table to include location data
    const alterAttendanceTable = `
      ALTER TABLE attendance 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(6, 2),
      ADD COLUMN IF NOT EXISTS is_within_geofence BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS work_location_id INT,
      ADD COLUMN IF NOT EXISTS distance_from_work DECIMAL(8, 2),
      ADD FOREIGN KEY IF NOT EXISTS (work_location_id) REFERENCES work_locations(id)
    `;

    await db.query(createLocationsTable);
    console.log("✅ Work locations table created successfully!");

    // You might need to check if columns exist first
    try {
      await db.query(alterAttendanceTable);
      console.log("✅ Attendance table updated with location fields!");
    } catch (error) {
      if (!error.message.includes("Duplicate column")) {
        console.error("❌ Error updating attendance table:", error.message);
      }
    }

    // Insert default work locations (example)
    const insertDefaultLocation = `
      INSERT IGNORE INTO work_locations (name, address, latitude, longitude, radius_meters)
      VALUES 
        ('Main Office', '123 Business Street, City', 40.7128, -74.0060, 100),
        ('Branch Office', '456 Corporate Ave, City', 40.7589, -73.9851, 150)
    `;

    await db.query(insertDefaultLocation);
    console.log("✅ Default work locations inserted!");
  } catch (error) {
    console.error("❌ Error initializing geofencing tables:", error.message);
  }
}


// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Check if coordinates are within any work location
async function checkGeofence(latitude, longitude) {
  try {
    const query = `
      SELECT id, name, latitude, longitude, radius_meters 
      FROM work_locations 
      WHERE is_active = TRUE
    `;

    const [locations] = await db.query(query);

    for (const location of locations) {
      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(location.latitude),
        parseFloat(location.longitude)
      );

      if (distance <= location.radius_meters) {
        return {
          isWithinGeofence: true,
          workLocation: location,
          distance: Math.round(distance),
        };
      }
    }

    // Find closest location for reference
    let closestLocation = null;
    let minDistance = Infinity;

    for (const location of locations) {
      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(location.latitude),
        parseFloat(location.longitude)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestLocation = { ...location, distance: Math.round(distance) };
      }
    }

    return {
      isWithinGeofence: false,
      closestLocation,
      distance: Math.round(minDistance),
    };
  } catch (error) {
    console.error("Error checking geofence:", error);
    throw error;
  }
}

// GEOFENCING API ROUTES

// Get all work locations
app.get("/api/work-locations", async (req, res) => {
  try {
    const query = `
      SELECT id, name, address, latitude, longitude, radius_meters, is_active
      FROM work_locations
      ORDER BY name
    `;

    const [rows] = await db.query(query);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching work locations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch work locations",
      error: error.message,
    });
  }
});

// Add new work location
app.post("/api/work-locations", async (req, res) => {
  try {
    const { name, address, latitude, longitude, radiusMeters = 100 } = req.body;

    if (!name || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Name, latitude, and longitude are required",
      });
    }

    const query = `
      INSERT INTO work_locations (name, address, latitude, longitude, radius_meters)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      name,
      address,
      latitude,
      longitude,
      radiusMeters,
    ]);

    res.json({
      success: true,
      message: "Work location added successfully",
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error("Error adding work location:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add work location",
      error: error.message,
    });
  }
});

// Validate location for attendance
app.post("/api/validate-location", async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Check if accuracy is acceptable (less than 50 meters)
    if (accuracy && accuracy > 50) {
      return res.json({
        success: false,
        message:
          "Location accuracy is too low. Please try again in an open area.",
        data: { accuracy, isAccurate: false },
      });
    }

    const geofenceResult = await checkGeofence(latitude, longitude);

    res.json({
      success: true,
      data: {
        ...geofenceResult,
        coordinates: { latitude, longitude },
        accuracy,
        isAccurate: !accuracy || accuracy <= 50,
      },
    });
  } catch (error) {
    console.error("Error validating location:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate location",
      error: error.message,
    });
  }
});

// Enhanced attendance creation with geofencing
app.post("/api/attendance-with-location", async (req, res) => {
  try {
    const {
      employeeId,
      date,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      status = "present",
      workFromHome = false,
      location,
      notes,
      latitude,
      longitude,
      locationAccuracy,
    } = req.body;

    let geofenceResult = null;
    let isWithinGeofence = false;
    let workLocationId = null;
    let distanceFromWork = null;

    // Only check geofence if not working from home and coordinates provided
    if (!workFromHome && latitude && longitude) {
      try {
        geofenceResult = await checkGeofence(latitude, longitude);
        isWithinGeofence = geofenceResult.isWithinGeofence;

        if (geofenceResult.workLocation) {
          workLocationId = geofenceResult.workLocation.id;
          distanceFromWork = geofenceResult.distance;
        } else if (geofenceResult.closestLocation) {
          distanceFromWork = geofenceResult.distance;
        }

        // If not within geofence, you might want to restrict attendance
        if (!isWithinGeofence && !workFromHome) {
          return res.status(400).json({
            success: false,
            message: `You are ${distanceFromWork}m away from the nearest work location. Please move closer to clock in.`,
            data: {
              geofenceInfo: geofenceResult,
              requiredDistance:
                geofenceResult.closestLocation?.radius_meters || 100,
            },
          });
        }
      } catch (geofenceError) {
        console.error("Geofence check failed:", geofenceError);
        // Continue without geofence if there's an error
      }
    }

    // Calculate total hours
    const totalHours = calculateTotalHours(
      clockIn,
      clockOut,
      breakStart,
      breakEnd
    );

    // Calculate break hours
    let breakHours = 0;
    if (breakStart && breakEnd) {
      breakHours = calculateTotalHours(breakStart, breakEnd);
    }

    const query = `
      INSERT INTO attendance (
        employee_id, date, clock_in, clock_out, break_start, break_end,
        total_hours, break_hours, status, work_from_home, location, notes,
        latitude, longitude, location_accuracy, is_within_geofence,
        work_location_id, distance_from_work
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        clock_in = VALUES(clock_in),
        clock_out = VALUES(clock_out),
        break_start = VALUES(break_start),
        break_end = VALUES(break_end),
        total_hours = VALUES(total_hours),
        break_hours = VALUES(break_hours),
        status = VALUES(status),
        work_from_home = VALUES(work_from_home),
        location = VALUES(location),
        notes = VALUES(notes),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        location_accuracy = VALUES(location_accuracy),
        is_within_geofence = VALUES(is_within_geofence),
        work_location_id = VALUES(work_location_id),
        distance_from_work = VALUES(distance_from_work),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await db.query(query, [
      employeeId,
      date,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      totalHours,
      breakHours,
      status,
      workFromHome,
      location,
      notes,
      latitude,
      longitude,
      locationAccuracy,
      isWithinGeofence,
      workLocationId,
      distanceFromWork,
    ]);

    res.json({
      success: true,
      message: "Attendance record saved successfully",
      data: {
        id: result.insertId || result.affectedRows,
        totalHours,
        geofenceInfo: geofenceResult,
        isWithinGeofence,
      },
    });
  } catch (error) {
    console.error("Error saving attendance with location:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save attendance record",
      error: error.message,
    });
  }
});

// Get attendance with location data
app.get(
  "/api/attendance-with-location/:employeeId/:year/:month",
  async (req, res) => {
    try {
      const { employeeId, year, month } = req.params;

      const query = `
      SELECT 
        a.*,
        wl.name as work_location_name,
        wl.address as work_location_address
      FROM attendance a
      LEFT JOIN work_locations wl ON a.work_location_id = wl.id
      WHERE a.employee_id = ? 
        AND YEAR(a.date) = ? 
        AND MONTH(a.date) = ?
      ORDER BY a.date
    `;

      const [rows] = await db.query(query, [employeeId, year, month]);

      // Convert rows to object with date as key
      const attendanceData = {};
      rows.forEach((row) => {
        const dateKey = row.date.toISOString().split("T")[0];
        attendanceData[dateKey] = {
          id: row.id,
          clockIn: row.clock_in,
          clockOut: row.clock_out,
          breakStart: row.break_start,
          breakEnd: row.break_end,
          totalHours: parseFloat(row.total_hours || 0),
          breakHours: parseFloat(row.break_hours || 0),
          overtimeHours: parseFloat(row.overtime_hours || 0),
          lateMinutes: row.late_minutes || 0,
          earlyLeavingMinutes: row.early_leaving_minutes || 0,
          status: row.status,
          workFromHome: row.work_from_home,
          location: row.location,
          notes: row.notes,
          isApproved: row.is_approved,
          // Location data
          latitude: row.latitude,
          longitude: row.longitude,
          locationAccuracy: row.location_accuracy,
          isWithinGeofence: row.is_within_geofence,
          workLocationId: row.work_location_id,
          workLocationName: row.work_location_name,
          workLocationAddress: row.work_location_address,
          distanceFromWork: row.distance_from_work,
        };
      });

      res.json({
        success: true,
        data: attendanceData,
      });
    } catch (error) {
      console.error("Error fetching attendance with location:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch attendance data",
        error: error.message,
      });
    }
  }
);
//Courses API
app.get("/api/courses", async (req, res) => {
  try {
    // Get all active courses
    const coursesQuery = `
      SELECT id, title, icon, description, duration, student_count, level, created_at, updated_at
      FROM courses 
      WHERE is_active = TRUE
      ORDER BY id ASC
    `;

    const coursesResult = await db.query(coursesQuery);
    const courses = coursesResult.rows;

    for (let course of courses) {
      // Get platforms
      const platformsQuery = `
        SELECT p.name 
        FROM platforms p
        JOIN course_platforms cp ON p.id = cp.platform_id
        WHERE cp.course_id = $1
      `;
      const platformsResult = await db.query(platformsQuery, [course.id]);
      course.platforms = platformsResult.rows.map((p) => p.name);

      // Get topics
      const topicsQuery = `
        SELECT topic_name 
        FROM course_topics 
        WHERE course_id = $1
        ORDER BY topic_order ASC
      `;
      const topicsResult = await db.query(topicsQuery, [course.id]);
      course.topics = topicsResult.rows.map((t) => t.topic_name);

      // Get features
      const featuresQuery = `
        SELECT feature_name 
        FROM course_features 
        WHERE course_id = $1
        ORDER BY feature_order ASC
      `;
      const featuresResult = await db.query(featuresQuery, [course.id]);
      course.features = featuresResult.rows.map((f) => f.feature_name);

      // Rename student_count to students
      course.students = course.student_count;
      delete course.student_count;
    }

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
      error: error.message,
    });
  }
});

// GET single course by ID
app.get("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = req.db;

    // Get course details
    const courseQuery = `
      SELECT id, title, icon, description, duration, student_count, level, created_at, updated_at
      FROM courses 
      WHERE id = ? AND is_active = TRUE
    `;

    const [courseResult] = await connection.execute(courseQuery, [id]);

    if (courseResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const course = courseResult[0];

    // Get platforms
    const platformsQuery = `
      SELECT p.name 
      FROM platforms p
      JOIN course_platforms cp ON p.id = cp.platform_id
      WHERE cp.course_id = ?
    `;
    const [platforms] = await connection.execute(platformsQuery, [id]);
    course.platforms = platforms.map((p) => p.name);

    // Get topics
    const topicsQuery = `
      SELECT topic_name 
      FROM course_topics 
      WHERE course_id = ?
      ORDER BY topic_order ASC
    `;
    const [topics] = await connection.execute(topicsQuery, [id]);
    course.topics = topics.map((t) => t.topic_name);

    // Get features
    const featuresQuery = `
      SELECT feature_name 
      FROM course_features 
      WHERE course_id = ?
      ORDER BY feature_order ASC
    `;
    const [features] = await connection.execute(featuresQuery, [id]);
    course.features = features.map((f) => f.feature_name);

    // Rename student_count to students for frontend compatibility
    course.students = course.student_count;
    delete course.student_count;

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course",
      error: error.message,
    });
  }
});

// POST create new course
app.post("/api/courses", async (req, res) => {
  try {
    const {
      title,
      icon,
      description,
      duration,
      student_count,
      level,
      platforms,
      topics,
      features,
    } = req.body;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Insert course
      const courseQuery = `
        INSERT INTO courses (title, icon, description, duration, student_count, level)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const [courseResult] = await connection.execute(courseQuery, [
        title,
        icon,
        description,
        duration,
        student_count,
        level,
      ]);
      const courseId = courseResult.insertId;

      // Insert platforms
      if (platforms && platforms.length > 0) {
        for (let platformName of platforms) {
          // Insert platform if it doesn't exist
          const insertPlatformQuery = `
            INSERT IGNORE INTO platforms (name) VALUES (?)
          `;
          await connection.execute(insertPlatformQuery, [platformName]);

          // Get platform ID
          const getPlatformQuery = `SELECT id FROM platforms WHERE name = ?`;
          const [platformResult] = await connection.execute(getPlatformQuery, [
            platformName,
          ]);
          const platformId = platformResult[0].id;

          // Link course to platform
          const linkQuery = `
            INSERT INTO course_platforms (course_id, platform_id) VALUES (?, ?)
          `;
          await connection.execute(linkQuery, [courseId, platformId]);
        }
      }

      // Insert topics
      if (topics && topics.length > 0) {
        for (let i = 0; i < topics.length; i++) {
          const topicQuery = `
            INSERT INTO course_topics (course_id, topic_name, topic_order) VALUES (?, ?, ?)
          `;
          await connection.execute(topicQuery, [courseId, topics[i], i + 1]);
        }
      }

      // Insert features
      if (features && features.length > 0) {
        for (let i = 0; i < features.length; i++) {
          const featureQuery = `
            INSERT INTO course_features (course_id, feature_name, feature_order) VALUES (?, ?, ?)
          `;
          await connection.execute(featureQuery, [
            courseId,
            features[i],
            i + 1,
          ]);
        }
      }

      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        message: "Course created successfully",
        data: { id: courseId },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create course",
      error: error.message,
    });
  }
});

// PUT update course
app.put("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      icon,
      description,
      duration,
      student_count,
      level,
      platforms,
      topics,
      features,
    } = req.body;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update course
      const courseQuery = `
        UPDATE courses 
        SET title = ?, icon = ?, description = ?, duration = ?, student_count = ?, level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await connection.execute(courseQuery, [
        title,
        icon,
        description,
        duration,
        student_count,
        level,
        id,
      ]);

      // Delete existing relationships
      await connection.execute(
        "DELETE FROM course_platforms WHERE course_id = ?",
        [id]
      );
      await connection.execute(
        "DELETE FROM course_topics WHERE course_id = ?",
        [id]
      );
      await connection.execute(
        "DELETE FROM course_features WHERE course_id = ?",
        [id]
      );

      // Re-insert platforms
      if (platforms && platforms.length > 0) {
        for (let platformName of platforms) {
          const insertPlatformQuery = `INSERT IGNORE INTO platforms (name) VALUES (?)`;
          await connection.execute(insertPlatformQuery, [platformName]);

          const getPlatformQuery = `SELECT id FROM platforms WHERE name = ?`;
          const [platformResult] = await connection.execute(getPlatformQuery, [
            platformName,
          ]);
          const platformId = platformResult[0].id;

          const linkQuery = `INSERT INTO course_platforms (course_id, platform_id) VALUES (?, ?)`;
          await connection.execute(linkQuery, [id, platformId]);
        }
      }

      // Re-insert topics
      if (topics && topics.length > 0) {
        for (let i = 0; i < topics.length; i++) {
          const topicQuery = `INSERT INTO course_topics (course_id, topic_name, topic_order) VALUES (?, ?, ?)`;
          await connection.execute(topicQuery, [id, topics[i], i + 1]);
        }
      }

      // Re-insert features
      if (features && features.length > 0) {
        for (let i = 0; i < features.length; i++) {
          const featureQuery = `INSERT INTO course_features (course_id, feature_name, feature_order) VALUES (?, ?, ?)`;
          await connection.execute(featureQuery, [id, features[i], i + 1]);
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: "Course updated successfully",
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update course",
      error: error.message,
    });
  }
});

// DELETE course (soft delete)
app.delete("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = req.db;

    const deleteQuery = `
      UPDATE courses 
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const [result] = await connection.execute(deleteQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete course",
      error: error.message,
    });
  }
});

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://portal.thevsoft.com",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));


const generateToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const generateJWT = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "24h",
  });
};

const sendEmail = async (to, subject, html) => {
  try {
    await emailTransporter.sendMail({
      from: process.env.FROM_EMAIL || "noreply@internportal.com",
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
};


// Validation middleware
const validateSignUp = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  body("fullName")
    .isLength({ min: 2, max: 50 })
    .matches(/^[A-Za-z\s\-']+$/)
    .withMessage(
      "Full name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes"
    ),
];

const validateSignIn = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
];



// Routes

// 1. Sign Up Route
// Enhanced Sign Up Route with detailed error logging
app.post("/api/auth/register", validateSignUp, async (req, res) => {
  const client = await db.connect();
  try {
    console.log("🚀 Registration attempt started");
    console.log("📝 Request body:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Validation errors:", errors.array());
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const { email, password, fullName } = req.body;
    console.log("✅ Validation passed for:", { email, fullName });

    // ✅ Check if user already exists by email only
    console.log("🔍 Checking if user exists...");
    const existingUsers = await client.query(
      "SELECT id FROM interns WHERE email = $1",
      [email]
    );
    
    if (existingUsers.rows.length > 0) {
      console.log("❌ User already exists:", email);
      return res.status(409).json({
        error: "User with this email already exists",
      });
    }

    console.log("✅ User doesn't exist, proceeding...");

    // ✅ Hash password
    console.log("🔐 Hashing password...");
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log("✅ Password hashed successfully");

    // ✅ Generate verification token
    console.log("🎫 Generating verification token...");
    const verificationToken = generateToken();
    console.log("✅ Token generated:", verificationToken ? "Yes" : "No");

    // ✅ Insert new user
    console.log("💾 Inserting user into database...");
    console.log("📊 Insert query parameters:", [fullName, email, "password_hash", verificationToken]);
    
    const result = await client.query(
      `INSERT INTO interns (full_name, email, password_hash, verification_token) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [fullName, email, passwordHash, verificationToken]
    );

    console.log("✅ User inserted successfully, ID:", result.rows[0].id);

    // ✅ Send verification email
    console.log("📧 Sending verification email...");
    const verificationLink = `${
      process.env.FRONTEND_URL || "https://portal.thevsoft.com"
    }/verify-email?token=${verificationToken}`;
    
    const emailSent = await sendEmail(
      email,
      "Verify Your Intern Portal Account",
      `
        <h2>Welcome to Intern Portal!</h2>
        <p>Hi ${fullName},</p>
        <p>Thank you for registering. Please click the link below to verify your email address:</p>
        <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Verify Email
        </a>
        <p>If the button doesn't work, copy and paste this link: ${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
      `
    );

    console.log("📧 Email sent:", emailSent ? "Success" : "Failed");

    res.status(201).json({
      message: "Account created successfully! Please check your email for verification.",
      userId: result.rows[0].id,
      emailSent,
    });

  } catch (error) {
    console.error("💥 Sign up error:", error);
    console.error("📊 Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint,
    });
    
    // More specific error responses
    if (error.code === '42P01') {
      return res.status(500).json({ 
        error: "Database table 'interns' does not exist",
        details: "Please ensure the database schema is properly set up"
      });
    }
    
    if (error.code === '42703') {
      return res.status(500).json({ 
        error: "Database column does not exist",
        details: "Please check the table schema matches the query"
      });
    }
    
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: "User with this email already exists"
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error during registration",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// 2. Sign In Route
app.post("/api/auth/login", validateSignIn, async (req, res) => {
  const client = await db.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Get user from database
    const users = await client.query(
      "SELECT id, full_name, email, password_hash, is_verified FROM interns WHERE email = $1",
      [email]
    );

    if (users.rows.length === 0) {
      // Log failed attempt
      await client.query(
        "INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, $3)",
        [email, clientIp, false]
      );
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users.rows[0];

    // Check if account is verified
    if (!user.is_verified) {
      return res
        .status(401)
        .json({ error: "Please verify your email address before signing in" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Log failed attempt
      await client.query(
        "INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, $3)",
        [email, clientIp, false]
      );
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = generateJWT({
      userId: user.id,
      email: user.email,
    });

    // Update last login - using CURRENT_TIMESTAMP for PostgreSQL
    await client.query("UPDATE interns SET last_login = CURRENT_TIMESTAMP WHERE id = $1", [
      user.id,
    ]);

    // Log successful attempt
    await client.query(
      "INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, $3)",
      [email, clientIp, true]
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Sign in error:", error);
    res.status(500).json({ error: "Internal server error during login" });
  } finally {
    client.release();
  }
});

// 3. Forgot Password Route
app.post(
  "/api/auth/forgot-password",
  [body("email").isEmail().normalizeEmail()],
  async (req, res) => {
    const client = await db.connect();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Please provide a valid email address" });
      }

      const { email } = req.body;

      // Check if user exists
      const users = await client.query(
        "SELECT id, full_name FROM interns WHERE email = $1",
        [email]
      );

      // Always return success to prevent email enumeration
      res.json({
        message:
          "If an account with that email exists, we have sent a password reset link.",
      });

      if (users.rows.length > 0) {
        const user = users.rows[0];
        const resetToken = generateToken();
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour

        // Save reset token
        await client.query(
          "UPDATE interns SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
          [resetToken, resetExpires, user.id]
        );

        // Send reset email
        const resetLink = `${
          process.env.FRONTEND_URL || "https://portal.thevsoft.com"
        }/reset-password?token=${resetToken}`;
        await sendEmail(
          email,
          "Reset Your Intern Portal Password",
          `
          <h2>Password Reset Request</h2>
          <p>Hi ${user.full_name},</p>
          <p>We received a request to reset your password. Click the link below to reset it:</p>
          <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If the button doesn't work, copy and paste this link: ${resetLink}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
        `
        );
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  }
);

// 4. Reset Password Route
app.post(
  "/api/auth/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .isLength({ min: 8 })
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .withMessage("Password must meet security requirements"),
  ],
  async (req, res) => {
    const client = await db.connect();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { token, password } = req.body;

      // Find user with valid reset token
      const users = await client.query(
        "SELECT id FROM interns WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP",
        [token]
      );

      if (users.rows.length === 0) {
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token" });
      }

      const user = users.rows[0];

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12);

      // Update password and clear reset token
      await client.query(
        "UPDATE interns SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
        [passwordHash, user.id]
      );

      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  }
);

// 5. Email Verification Route
app.get("/api/auth/verify-email", async (req, res) => {
  const client = await db.connect();
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    // Find user with verification token
    const users = await client.query(
      "SELECT id, email FROM interns WHERE verification_token = $1",
      [token]
    );

    if (users.rows.length === 0) {
      return res.status(400).json({ error: "Invalid verification token" });
    }

    const user = users.rows[0];

    // Update user as verified
    await client.query(
      "UPDATE interns SET is_verified = TRUE, verification_token = NULL WHERE id = $1",
      [user.id]
    );

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// 6. Get User Profile (Protected Route)
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  const client = await db.connect();
  try {
    const users = await client.query(
      "SELECT id, full_name, email, created_at, last_login FROM interns WHERE id = $1",
      [req.user.userId]
    );

    if (users.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: users.rows[0] });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Health check
app.get('/api/health', (req, res) => {
  console.log('✅ Health check accessed');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});



// Resend Verification Email Route
app.post(
  "/api/auth/resend-verification",
  [body("email").isEmail().normalizeEmail()],
  async (req, res) => {
    const client = await db.connect();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Please provide a valid email address" });
      }

      const { email } = req.body;

      // Check if user exists and is not verified
      const users = await client.query(
        "SELECT id, full_name, is_verified FROM interns WHERE email = $1",
        [email]
      );

      if (users.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = users.rows[0];

      if (user.is_verified) {
        return res.status(400).json({ error: "Account is already verified" });
      }

      // Generate new verification token
      const verificationToken = generateToken();

      // Update verification token
      await client.query(
        "UPDATE interns SET verification_token = $1 WHERE id = $2",
        [verificationToken, user.id]
      );

      // Send verification email
      const verificationLink = `${
        process.env.FRONTEND_URL || "https://portal.thevsoft.com"
      }/verify-email?token=${verificationToken}`;
      await sendEmail(
        email,
        "Verify Your Intern Portal Account",
        `
        <h2>Email Verification</h2>
        <p>Hi ${user.full_name},</p>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>If the button doesn't work, copy and paste this link: ${verificationLink}</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `
      );

      res.json({ message: "Verification email sent successfully!" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  }
);

//InternShip - PostgreSQL Compatible Version

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Helper function to calculate days remaining
const calculateDaysRemaining = (endDate) => {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// ============= DASHBOARD ROUTES =============

// Get dashboard data for authenticated intern
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  console.log('🏠 Dashboard route accessed by user:', req.user.id);
  
  try {
    const internId = req.user.id;
    
    if (!internId) {
      console.log('❌ No user ID in token');
      return res.status(400).json({ 
        error: 'Invalid token: missing user ID',
        user: req.user 
      });
    }

    // Test database connection with timeout
    try {
      console.log('🔍 Testing database connection...');
      const dbTest = await Promise.race([
        db.query('SELECT NOW() as current_time, 1 as test'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]);
      console.log('✅ Database connection OK:', dbTest.rows[0]);
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      
      // Return mock data if database fails
      return res.json({
        name: "Database Connection Failed - Mock Data",
        email: req.user.email || "test@example.com", 
        status: "active",
        trainingEndDate: "2025-08-25",
        tasksCompleted: 0,
        totalTasks: 5,
        daysRemaining: 45,
        upcomingDeadline: "Database offline",
        certificateProgress: 0,
        _error: "Database connection failed: " + dbError.message,
        _mock: true,
        _timestamp: new Date().toISOString()
      });
    }

    // Try to get intern data
    try {
      console.log('📋 Querying intern data for ID:', internId);
      const internResult = await db.query(
        'SELECT id, full_name, email, status, progress, start_date, end_date FROM interns WHERE id = $1',
        [internId]
      );

      console.log('📊 Query result:', {
        rowCount: internResult.rows.length,
        firstRow: internResult.rows[0] || null
      });

      if (internResult.rows.length === 0) {
        console.log('❌ No intern found with ID:', internId);
        
        // Check if interns table exists and has data
        try {
          const tableCheck = await db.query(
            "SELECT COUNT(*) as total_interns FROM interns"
          );
          console.log('📊 Total interns in database:', tableCheck.rows[0].total_interns);
        } catch (tableError) {
          console.error('❌ Interns table might not exist:', tableError.message);
        }
        
        return res.json({
          name: `No Intern Found (ID: ${internId}) - Mock Data`,
          email: req.user.email || "test@example.com",
          status: "active", 
          trainingEndDate: "2025-08-25",
          tasksCompleted: 0,
          totalTasks: 5,
          daysRemaining: 45,
          upcomingDeadline: "No upcoming deadlines",
          certificateProgress: 0,
          _mock: true,
          _note: `No intern found with ID: ${internId}`,
          _timestamp: new Date().toISOString()
        });
      }

      const intern = internResult.rows[0];
      console.log('👤 Found intern:', intern.full_name);

      // Get task statistics (with fallback)
      let taskStats = { total_tasks: 0, completed_tasks: 0 };
      try {
        const tasksResult = await db.query(
          `SELECT 
            COUNT(*) as total_tasks,
            COUNT(CASE WHEN status IN ('completed', 'submitted', 'approved') THEN 1 END) as completed_tasks
          FROM tasks 
          WHERE assigned_to = $1`,
          [internId]
        );
        taskStats = tasksResult.rows[0] || taskStats;
        console.log('📊 Task stats:', taskStats);
      } catch (taskError) {
        console.warn('⚠️ Task query failed, using defaults:', taskError.message);
      }

      // Calculate days remaining
      const daysRemaining = calculateDaysRemaining(intern.end_date);
      
      // Calculate certificate progress
      const totalTasks = parseInt(taskStats.total_tasks) || 1;
      const completedTasks = parseInt(taskStats.completed_tasks) || 0;
      const certificateProgress = Math.round((completedTasks / totalTasks) * 100);

      // Get upcoming deadline (with fallback)
      let upcomingDeadline = "No upcoming deadlines";
      try {
        const upcomingResult = await db.query(
          `SELECT title, due_date 
          FROM tasks 
          WHERE assigned_to = $1 AND status IN ('pending', 'in_progress') 
          ORDER BY due_date ASC 
          LIMIT 1`,
          [internId]
        );
        
        if (upcomingResult.rows.length > 0) {
          const task = upcomingResult.rows[0];
          upcomingDeadline = `${task.title} - ${new Date(task.due_date).toLocaleDateString()}`;
        }
      } catch (deadlineError) {
        console.warn('⚠️ Deadline query failed:', deadlineError.message);
      }

      // Prepare final response
      const dashboardData = {
        name: intern.full_name,
        email: intern.email,
        status: intern.status,
        progress: intern.progress,
        trainingEndDate: intern.end_date ? new Date(intern.end_date).toISOString().split('T')[0] : null,
        tasksCompleted: completedTasks,
        totalTasks: parseInt(taskStats.total_tasks),
        daysRemaining: daysRemaining,
        upcomingDeadline: upcomingDeadline,
        certificateProgress: certificateProgress,
        _timestamp: new Date().toISOString()
      };

      console.log('✅ Dashboard data prepared successfully');
      res.json(dashboardData);

    } catch (queryError) {
      console.error('❌ Database query error:', queryError);
      
      // Return mock data on query error
      res.json({
        name: "Database Query Failed - Mock Data",
        email: req.user.email || "test@example.com",
        status: "active",
        trainingEndDate: "2025-08-25", 
        tasksCompleted: 0,
        totalTasks: 5,
        daysRemaining: 45,
        upcomingDeadline: "Database query failed",
        certificateProgress: 0,
        _error: queryError.message,
        _mock: true,
        _timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Dashboard route error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
});


// ============= TASK ROUTES =============

// Get all tasks for authenticated intern
app.get('/api/tasks', authenticateToken, async (req, res) => {
  console.log('📋 Tasks route accessed by user:', req.user.id);
  
  try {
    const internId = req.user.id;
    
    const tasksResult = await db.query(
      `SELECT 
        id, title, description, status, due_date, created_at, 
        submission_text, submission_file_path, feedback, grade
      FROM tasks 
      WHERE assigned_to = $1 
      ORDER BY due_date ASC`,
      [internId]
    );

    const formattedTasks = tasksResult.rows.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      assignedDate: new Date(task.created_at).toISOString().split('T')[0],
      dueDate: new Date(task.due_date).toISOString().split('T')[0],
      status: task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', ' '),
      submissionText: task.submission_text,
      submissionFile: task.submission_file_path,
      feedback: task.feedback,
      grade: task.grade
    }));

    console.log('✅ Tasks loaded:', formattedTasks.length);
    res.json(formattedTasks);
  } catch (error) {
    console.error('❌ Tasks error:', error);
    res.json([]); // Return empty array on error
  }
});

// Get single task details
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const internId = req.user.id;

    const tasksResult = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND assigned_to = $2',
      [taskId, internId]
    );

    if (tasksResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(tasksResult.rows[0]);
  } catch (error) {
    console.error('Task details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit task
app.post('/api/tasks/:id/submit', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const internId = req.user.id;
    const { submissionText } = req.body;

    // Check if task exists and belongs to intern
    const tasksResult = await db.query(
      'SELECT id FROM tasks WHERE id = $1 AND assigned_to = $2',
      [taskId, internId]
    );

    if (tasksResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Prepare update query
    let updateQuery = 'UPDATE tasks SET submission_text = $1, status = $2, updated_at = CURRENT_TIMESTAMP';
    let updateParams = [submissionText, 'submitted'];
    let paramIndex = 3;

    // Add file path if file was uploaded
    if (req.file) {
      updateQuery += `, submission_file_path = $${paramIndex}`;
      updateParams.push(req.file.path);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex} AND assigned_to = $${paramIndex + 1}`;
    updateParams.push(taskId, internId);

    await db.query(updateQuery, updateParams);

    res.json({ message: 'Task submitted successfully' });
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= ANNOUNCEMENTS ROUTES =============

// Get announcements (you can expand this to fetch from a database table)
app.get('/api/announcements', authenticateToken, async (req, res) => {
  console.log('📢 Announcements route accessed');
  
  try {
    const announcements = [
      "🎉 Welcome to the internship program!",
      "📚 New learning resources available in the portal", 
      "⏰ Weekly standup meetings every Monday at 10 AM",
      "📝 Please complete your weekly reports on time"
    ];
    res.json(announcements);
  } catch (error) {
    console.error('❌ Announcements error:', error);
    res.json([]);
  }
});

// ============= CERTIFICATE ROUTES =============

// Get certificate status
app.get('/api/timeline', authenticateToken, async (req, res) => {
  console.log('📅 Timeline route accessed');
  
  try {
    const timelineSteps = [
      { title: "Training Start", date: "Week 1", status: "completed" },
      { title: "Basic Tasks", date: "Week 2-4", status: "completed" },
      { title: "Project Work", date: "Week 5-8", status: "current" },
      { title: "Final Review", date: "Week 9", status: "pending" },
      { title: "Completion", date: "Week 10", status: "pending" }
    ];
    res.json(timelineSteps);
  } catch (error) {
    console.error('❌ Timeline error:', error);
    res.json([]);
  }
});

console.log('✅ All API routes registered');
// Download certificate
app.get('/api/certificate/download', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    const certificatesResult = await db.query(
      'SELECT certificate_file_path FROM certificates WHERE intern_id = $1 AND status = $2',
      [internId, 'issued']
    );

    if (certificatesResult.rows.length === 0) {
      return res.status(404).json({ message: 'Certificate not available for download' });
    }

    const filePath = certificatesResult.rows[0].certificate_file_path;
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ message: 'Certificate file not found' });
    }
  } catch (error) {
    console.error('Certificate download error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= PROFILE ROUTES =============

// Get intern profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    const profileResult = await db.query(
      'SELECT employee_id, full_name, email, phone, address, start_date, end_date, status, progress, batch FROM interns WHERE id = $1',
      [internId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json(profileResult.rows[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Update intern profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;
    const { full_name, phone, address } = req.body;

    await db.query(
      'UPDATE interns SET full_name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [full_name, phone, address, internId]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= TIMELINE ROUTES =============

// Get training timeline
app.get('/api/timeline', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    // Get intern's start and end dates
    const internInfoResult = await db.query(
      'SELECT start_date, end_date FROM interns WHERE id = $1',
      [internId]
    );

    if (internInfoResult.rows.length === 0) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    const { start_date, end_date } = internInfoResult.rows[0];

    // Calculate timeline steps based on start and end dates
    const timelineSteps = [
      { 
        title: "Training Start", 
        date: start_date ? new Date(start_date).toLocaleDateString() : "June 1, 2025", 
        status: "completed" 
      },
      { 
        title: "Basic Tasks", 
        date: "June 15, 2025", 
        status: "completed" 
      },
      { 
        title: "Mid-review", 
        date: "July 15, 2025", 
        status: "current" 
      },
      { 
        title: "Final Project", 
        date: "August 1, 2025", 
        status: "upcoming" 
      },
      { 
        title: "Certificate Issued", 
        date: end_date ? new Date(end_date).toLocaleDateString() : "August 15, 2025", 
        status: "upcoming" 
      }
    ];

    res.json(timelineSteps);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin login debug route
app.post('/api/admin/login-debug', (req, res) => {
  console.log('🔍 Admin login debug - Headers:', req.headers);
  console.log('🔍 Admin login debug - Origin:', req.headers.origin);
  res.json({
    success: true,
    message: 'Admin login debug successful',
    origin: req.headers.origin,
    body: req.body
  });
});
// Catch-all debug for admin routes
app.use('/api/admin/*', (req, res, next) => {
  console.log(`🔍 Admin route accessed: ${req.method} ${req.path}`);
  console.log(`🔍 Origin: ${req.headers.origin}`);
  console.log(`🔍 Headers:`, req.headers);
  next();
});

console.log('🔧 Mounting admin routes...');
app.use('/api/admin', adminRoutes);
console.log('✅ Admin routes successfully mounted on /api/admin');



console.log('📋 Final route listing:');
function logRoutes(app) {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Direct routes
      const method = Object.keys(middleware.route.methods)[0].toUpperCase();
      routes.push(`✅ ROUTE: [${method}] ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.regexp) {
      // Mounted routers
      const routerPath = middleware.regexp.source
        .replace('\\', '')
        .replace('^', '')
        .replace('\\/?(?=\\/|$)', '')
        .replace(/[^a-zA-Z0-9\/\-_]/g, '');
      
      if (middleware.handle.stack) {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            const method = Object.keys(handler.route.methods)[0].toUpperCase();
            const fullPath = routerPath + handler.route.path;
            routes.push(`✅ ROUTE: [${method}] ${fullPath}`);
          }
        });
      }
    }
  });
  
  // Sort routes for better readability
  routes.sort().forEach(route => console.log(route));
}

// Call this instead of the existing route debug code
logRoutes(app);

// ============= ERROR HANDLING =============


app.use('/api/*', (req, res) => {
  console.log(`❌ API route not found: ${req.method} ${req.originalUrl}`);
  console.log('Available routes should include: /api/dashboard, /api/tasks, /api/announcements, /api/timeline');
  
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/debug/user',
      'GET /api/dashboard',
      'GET /api/tasks', 
      'GET /api/announcements',
      'GET /api/timeline'
    ],
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
  
  next(err);
});

console.log('✅ Error handlers registered');
console.log('🚀 Server setup complete - all routes should now work');

// Debug: Log all registered routes
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    const method = Object.keys(middleware.route.methods)[0].toUpperCase();
    console.log(`✅ ROUTE: [${method}] ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      const route = handler.route;
      if (route) {
        const method = Object.keys(route.methods)[0].toUpperCase();
        console.log(`✅ ROUTE: [${method}] ${route.path}`);
      }
    });
  }
});


// 404 handler - make it more specific
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({ 
      success: false,
      message: 'API endpoint not found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  next();
});

app.get('/api/debug/token', authenticateToken, (req, res) => {
  res.json({
    message: 'Token is valid',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Debug route (with auth)
app.get('/api/debug/user', authenticateToken, (req, res) => {
  console.log('✅ Debug route accessed by user:', req.user.id);
  res.json({
    success: true,
    message: 'Authentication working',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log("📊 Make sure your PostgreSQL database is running!");
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('🛑 Server closed due to SIGTERM');
  });
});
