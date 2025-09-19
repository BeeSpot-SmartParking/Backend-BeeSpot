const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const paymentRoutes = require('./routes/payment');
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Smart Parking Algeria API',
    version: '1.0.0',
    endpoints: {
      parking: '/api/parking',
      reservations: '/api/reservations',
      users: '/api/users',
      companies: '/api/companies',
      admin: '/api/admin',
      health: '/api/health'
    }
  });
});

// Add this to app.js temporarily
app.get('/api/test-db', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, timestamp: result.rows[0].now });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Routes
app.use('/api/parking', require('./routes/parking'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api/payment', paymentRoutes); 


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/parking',
      'GET /api/parking/search',
      'POST /api/parking',
      'POST /api/reservations',
      'GET /api/reservations',
      'POST /api/users',
      'GET /api/users',
      'POST /api/companies',
      'GET /api/companies',
      'GET /api/admin/metrics'
    ]
  });
});

module.exports = app;
