const pool = require('../../config/database');

// Get all interns with pagination and filtering
const getInterns = async (req, res) => {
  try {
    const { search, status, batch, page = 1, limit = 10 } = req.query;
    let query = 'SELECT * FROM interns WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1} OR employee_id ILIKE $${paramIndex + 2})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramIndex += 3;
    }

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (batch && batch !== 'all') {
      query += ` AND batch = $${paramIndex}`;
      params.push(batch);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM interns WHERE 1=1';
    let countParams = [];
    let countParamIndex = 1;
    
    if (search) {
      countQuery += ` AND (full_name ILIKE $${countParamIndex} OR email ILIKE $${countParamIndex + 1} OR employee_id ILIKE $${countParamIndex + 2})`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countParamIndex += 3;
    }
    if (status && status !== 'all') {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    if (batch && batch !== 'all') {
      countQuery += ` AND batch = $${countParamIndex}`;
      countParams.push(batch);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      interns: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update intern status
const updateInternStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.query(
      'UPDATE interns SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, user_type, action, description) VALUES ($1, $2, $3, $4)',
      [req.admin.id, 'admin', 'update_intern_status', `Changed intern status to ${status}`]
    );

    res.json({ message: 'Intern status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update intern progress
const updateInternProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress } = req.body;
    
    await pool.query(
      'UPDATE interns SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [progress, id]
    );

    res.json({ message: 'Intern progress updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getInterns,
  updateInternStatus,
  updateInternProgress
};