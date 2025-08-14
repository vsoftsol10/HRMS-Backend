const { allowedOrigins } = require('../../config/cors');

const handlePreflight = (req, res) => {
  console.log('🚀 Preflight OPTIONS request from:', req.headers.origin);
  
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    
    console.log('✅ Preflight response sent with origin:', origin);
    res.sendStatus(200);
  } else {
    console.log('❌ Preflight blocked for origin:', origin);
    res.sendStatus(403);
  }
};

module.exports = { handlePreflight };