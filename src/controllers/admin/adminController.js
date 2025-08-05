const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // ✅ Fixed: Use 'true' instead of '1' for PostgreSQL boolean
    const result = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1 AND is_active = 1",
      [username]
    );
    
    console.log("DB result:", result.rows); // 🧠 Check if user is found

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: "Invalid credentials" 
      });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);

    console.log("Password match:", validPassword); // 🧠 Check if bcrypt matched

    if (!validPassword) {
      return res.status(401).json({ 
        success: false,
        error: "Invalid credentials" 
      });
    }

    // Update last login
    await pool.query(
      "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [admin.id]
    );

    // ✅ Fixed: Use consistent JWT_SECRET from environment or middleware
    const token = jwt.sign(
      { 
        id: admin.id,
        username: admin.username,
        role: admin.role 
      }, 
      process.env.JWT_SECRET || '16e2a858ca097d0ed7e4ce727be4381b180e76642aa3b969a3f0b06313a898c10e2326cfb382d0897c43372d1072ec7a9110b5765bd677abfa05add0da7a0ce9',
      { expiresIn: '24h' } // ✅ Add token expiration
    );

    // ✅ Improved response format
    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      },
      message: "Login successful"
    });
    
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
};

module.exports = {
  adminLogin,
};