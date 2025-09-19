// src/app.js - Updated with basic parking and reservation routes

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

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
      health: '/api/health'
    }
  });
});

// API Routes
app.use('/api/parking', require('./routes/parking'));
app.use('/api/reservations', require('./routes/reservations'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/parking',
      'GET /api/parking/search',
      'POST /api/parking',
      'GET /api/parking/:id',
      'PUT /api/parking/:id',
      'PATCH /api/parking/:id',
      'DELETE /api/parking/:id',
      'GET /api/parking/:id/spots',
      'PUT /api/parking/spots/:id/availability',
      'PATCH /api/parking/spots/:id/availability',
      'POST /api/reservations',
      'GET /api/reservations',
      'PUT /api/reservations/:id/cancel',
      'PATCH /api/reservations/:id/cancel',
      'PUT /api/reservations/:id/complete',
      'PATCH /api/reservations/:id/complete',
      'GET /api/reservations/code/:confirmationCode'
    ]
  });
});

module.exports = app;
