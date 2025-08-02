const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || '16e2a858ca097d0ed7e4ce727be4381b180e76642aa3b969a3f0b06313a898c10e2326cfb382d0897c43372d1072ec7a9110b5765bd677abfa05add0da7a0ce9';

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT * FROM admin_users WHERE id = ? AND is_active = true',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.admin = rows[0];
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

module.exports = { authenticateAdmin, JWT_SECRET };