const pool = require('../../config/database');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    console.log('🚀 Getting dashboard stats for admin:', req.admin.id);

    // Get total interns count
    const totalInternsResult = await pool.query(
      'SELECT COUNT(*) as count FROM interns'
    );

    // Get pending approvals count  
    const pendingApprovalsResult = await pool.query(
      "SELECT COUNT(*) as count FROM interns WHERE status = 'pending'"
    );

    // Get active interns count
    const activeInternsResult = await pool.query(
      "SELECT COUNT(*) as count FROM interns WHERE status = 'active'"
    );

    // Get completed interns count
    const completedInternsResult = await pool.query(
      "SELECT COUNT(*) as count FROM interns WHERE status = 'completed'"
    );

    // Get average progress
    const avgProgressResult = await pool.query(
      'SELECT AVG(progress) as avg_progress FROM interns WHERE progress IS NOT NULL'
    );

    const stats = {
      totalInterns: parseInt(totalInternsResult.rows[0].count) || 0,
      pendingApprovals: parseInt(pendingApprovalsResult.rows[0].count) || 0,
      activeInterns: parseInt(activeInternsResult.rows[0].count) || 0,
      completedInterns: parseInt(completedInternsResult.rows[0].count) || 0,
      avgProgress: Math.round(parseFloat(avgProgressResult.rows[0].avg_progress)) || 0
    };

    console.log('✅ Dashboard stats:', stats);

    res.status(200).json({
      success: true,
      ...stats
    });

  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
};

// Get recent activities
const getRecentActivities = async (req, res) => {
  try {
    console.log('🚀 Getting recent activities for admin:', req.admin.id);

    // Get recent activities from database
    const activitiesResult = await pool.query(`
      SELECT 
        'intern_registration' as activity_type,
        i.full_name as intern_name,
        'registered for internship' as description,
        i.created_at,
        i.status
      FROM interns i
      ORDER BY i.created_at DESC
      LIMIT 10
    `);

    // Format activities
    const activities = activitiesResult.rows.map(activity => ({
      id: Math.random().toString(36).substr(2, 9),
      intern_name: activity.intern_name,
      description: activity.description,
      created_at: activity.created_at,
      type: activity.activity_type,
      status: activity.status
    }));

    console.log('✅ Recent activities count:', activities.length);

    res.status(200).json({
      success: true,
      activities: activities
    });

  } catch (error) {
    console.error('❌ Recent activities error:', error);
    
    // Return empty activities array instead of error for better UX
    res.status(200).json({
      success: true,
      activities: []
    });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivities
};