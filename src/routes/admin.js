const express = require('express');
const router = express.Router();
const {
  getDashboardMetrics,
} = require('../controllers/adminController');


router.get('/analytics/company/:companyId', adminController.getCompanyAnalytics);
router.get('/sensor-data/parking/:parkingId', adminController.getParkingSensorData);

// Get all key metrics and recent data for the admin dashboard
router.get('/metrics', getDashboardMetrics);

module.exports = router;
