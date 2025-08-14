const express = require('express');
const { allowedOrigins } = require('../../config/cors');
const db = require('../../config/database');

const router = express.Router();

// CORS debug route
router.get('/cors-debug', (req, res) => {
  res.json({
    origin: req.headers.origin,
    headers: req.headers,
    method: req.method,
    url: req.url,
    allowedOrigins: allowedOrigins
  });
});

// CORS test route
router.get('/cors-test', (req, res) => {
  res.json({ success: true, message: 'CORS test successful' });
});

// Database test route
router.get('/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ message: '✅ PostgreSQL connected', time: result.rows[0].now });
  } catch (err) {
    console.error('❌ PostgreSQL query error:', err.message);
    res.status(500).json({ error: 'DB Query Failed' });
  }
});

// General test route
router.get('/test', (req, res) => {
  console.log('✅ Test route accessed successfully');
  res.json({ 
    message: 'Backend server is working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;