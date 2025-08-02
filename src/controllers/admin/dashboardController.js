const pool = require('../../config/database');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const totalInterns = await pool.query('SELECT COUNT(*) as count FROM interns');
    const pendingApprovals = await pool.query('SELECT COUNT(*) as count FROM interns WHERE status = $1', ['pending']);
    const activeInterns = await pool.query('SELECT COUNT(*) as count FROM interns WHERE status = $1', ['active']);
    const completedInterns = await pool.query('SELECT COUNT(*) as count FROM interns WHERE status = $1', ['completed']);
    const avgProgress = await pool.query('SELECT AVG(progress) as avg FROM interns WHERE status != $1', ['rejected']);

    res.json({
      totalInterns: parseInt(totalInterns.rows[0].count),
      pendingApprovals: parseInt(pendingApprovals.rows[0].count),
      activeInterns: parseInt(activeInterns.rows[0].count),
      completedInterns: parseInt(completedInterns.rows[0].count),
      avgProgress: Math.round(avgProgress.rows[0].avg || 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get recent activities
const getRecentActivities = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.*, i.full_name as intern_name 
      FROM activity_logs al 
      LEFT JOIN interns i ON al.user_id = i.id AND al.user_type = 'intern'
      ORDER BY al.created_at DESC 
      LIMIT 10
    `);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivities
};