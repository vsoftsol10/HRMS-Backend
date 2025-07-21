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

// Call this after your existing initialization
// initializeGeofencingTables();