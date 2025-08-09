const pool = require('../../config/database');

// Get all learning resources
const getResources = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM learning_resources WHERE is_active = 1 ORDER BY created_at DESC'
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Upload learning resource
const uploadResource = async (req, res) => {
  try {
    const { title, description, type, batch, external_url } = req.body;
    let file_path = null;
    
    if (req.file) {
      file_path = req.file.path;
    }
    
    const result = await pool.query(
      'INSERT INTO learning_resources (title, description, type, file_path, external_url, batch, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [title, description, type, file_path, external_url, batch, req.admin.id]
    );

    res.json({ id: result.rows[0].id, message: 'Resource uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getResources,
  uploadResource
};