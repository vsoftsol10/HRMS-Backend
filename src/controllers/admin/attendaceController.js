const pool = require('../../config/database');

// Get attendance records
const getAttendance = async (req, res) => {
  try {
    const { date, intern_id } = req.query;
    let query = `
      SELECT a.*, i.full_name as intern_name 
      FROM attendance a 
      JOIN interns i ON a.intern_id = i.id
    `;
    let params = [];
    let paramIndex = 1;

    if (date) {
      query += ` WHERE a.date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (intern_id) {
      query += date ? ' AND' : ' WHERE';
      query += ` a.intern_id = $${paramIndex}`;
      params.push(intern_id);
      paramIndex++;
    }

    query += ' ORDER BY a.date DESC, i.full_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark attendance
const markAttendance = async (req, res) => {
  try {
    const { intern_id, date, status, check_in_time, check_out_time, notes } = req.body;
    
    await pool.query(
      `INSERT INTO attendance (intern_id, date, status, check_in_time, check_out_time, notes, marked_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (intern_id, date) 
       DO UPDATE SET 
       status = EXCLUDED.status, 
       check_in_time = EXCLUDED.check_in_time, 
       check_out_time = EXCLUDED.check_out_time, 
       notes = EXCLUDED.notes,
       marked_by = EXCLUDED.marked_by,
       updated_at = CURRENT_TIMESTAMP`,
      [intern_id, date, status, check_in_time, check_out_time, notes, req.admin.id]
    );

    res.json({ message: 'Attendance marked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAttendance,
  markAttendance
};