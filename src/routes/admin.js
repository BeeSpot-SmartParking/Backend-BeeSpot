const express = require('express');
const router = express.Router();
const {
  getDashboardMetrics,
} = require('../controllers/adminController');

// Get all key metrics and recent data for the admin dashboard
router.get('/metrics', getDashboardMetrics);

module.exports = router;
