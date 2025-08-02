const pool = require('../../config/database');

// Get all certificates
const getCertificates = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, i.full_name as intern_name, i.employee_id, i.email, i.batch
      FROM certificates c 
      JOIN interns i ON c.intern_id = i.id 
      ORDER BY c.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approve certificate
const approveCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE certificates SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['approved', req.admin.id, id]
    );

    res.json({ message: 'Certificate approved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCertificates,
  approveCertificate
};