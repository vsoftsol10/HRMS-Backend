const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1 AND is_active = 1",
      [username]
    );
    console.log("DB result:", result.rows); // 🧠 Check if user is found

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);

    console.log("Password match:", validPassword); // 🧠 Check if bcrypt matched

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await pool.query(
      "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [admin.id]
    );

    const token = jwt.sign({ id: admin.id }, JWT_SECRET);

    res.json({
      token,
      user: {
        // Change 'admin' to 'user'
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  adminLogin,
};
