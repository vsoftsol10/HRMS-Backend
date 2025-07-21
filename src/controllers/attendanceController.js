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