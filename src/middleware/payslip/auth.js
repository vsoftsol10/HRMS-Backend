const jwt = require("jsonwebtoken");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log('🔍 Auth middleware:', { 
    path: req.path,
    method: req.method,
    hasAuthHeader: !!authHeader, 
    hasToken: !!token
  });

  if (!token) {
    console.log('❌ No token provided for:', req.path);
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    
    if (decoded.userId && !decoded.id) {
      decoded.id = decoded.userId;
    }
    
    req.user = decoded;
    console.log('✅ Token valid for user:', req.user.id);
    next();
  } catch (error) {
    console.error('❌ JWT verification failed:', error.message);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

module.exports = { authenticateToken };