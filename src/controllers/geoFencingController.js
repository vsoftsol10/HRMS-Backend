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