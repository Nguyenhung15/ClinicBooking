const path = require('path');
require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clinic_booking',
  // Comma-separated list of allowed origins, e.g. "http://localhost:5173,https://app.example.com"
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  jwtSecret: process.env.JWT_SECRET || 'clinic_booking_dev_secret_key_sdn302',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
};

env.isProduction = env.nodeEnv === 'production';

module.exports = env;
