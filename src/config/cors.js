const corsOptions = {
  origin: [
    'https://hrms-backend-5wau.onrender.com',
    'http://localhost:3000',
    'https://portal.thevsoft.com',
    'http://localhost:5173',
    'https://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ],
  optionsSuccessStatus: 200
}
module.exports = { corsOptions };