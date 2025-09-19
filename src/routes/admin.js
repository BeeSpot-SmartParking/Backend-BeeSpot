const express = require('express');
const router = express.Router();
const {
  getDashboardMetrics,
  getCompanyAnalytics,
  getParkingSensorData
} = require('../controllers/adminController');

// Fix: Use the imported functions, not adminController
router.get('/analytics/company/:companyId', getCompanyAnalytics);
router.get('/sensor-data/parking/:parkingId', getParkingSensorData);
router.get('/metrics', getDashboardMetrics);

module.exports = router;
