const pool = require('../../config/database');

// Get all batches
const getBatches = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM batches ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getBatches
};