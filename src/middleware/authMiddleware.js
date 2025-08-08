const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Use consistent JWT secret (same as controller)
const JWT_SECRET = process.env.JWT_SECRET || '16e2a858ca097d0ed7e4ce727be4381b180e76642aa3b969a3f0b06313a898c10e2326cfb382d0897c43372d1072ec7a9110b5765bd677abfa05add0da7a0ce9';

const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // ✅ FIXED: Use decoded.id instead of admin.id
    const result = await pool.query(
      'SELECT * FROM admin_users WHERE id = $1 AND is_active = true',
      [decoded.id] // ✅ Fixed: was admin.id, now decoded.id
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or user not found.'
      });
    }

    // Attach admin user data to request object
    req.admin = result.rows[0];
    
    // Continue to next middleware/route handler
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format.'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please login again.'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Authentication service error.'
      });
    }
  }
};

// Optional: Middleware to check specific roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }
    
    // roles can be a string or array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions.'
      });
    }
    
    next();
  };
};

module.exports = {
  authenticateAdmin,
  requireRole,
  JWT_SECRET
};