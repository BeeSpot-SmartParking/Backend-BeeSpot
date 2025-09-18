// src/routes/parking.js - Basic parking routes (no authentication)

const express = require('express');
const router = express.Router();

const {
  getAllParkingLocations,
  searchParking,
  getParkingLocationById,
  addParkingLocation,
  updateParkingAvailability,
  getParkingByWilaya,
  getAvailableWilayas
} = require('../controllers/parkingController');

// Get all parking locations
router.get('/', getAllParkingLocations);

// Search parking locations by coordinates
router.get('/search', searchParking);

// Get available wilayas
router.get('/wilayas', getAvailableWilayas);

// Get parking locations by wilaya
router.get('/wilaya/:wilaya', getParkingByWilaya);

// Get specific parking location by ID
router.get('/:id', getParkingLocationById);

// Add new parking location
router.post('/', addParkingLocation);

// Update parking availability
router.put('/:id/availability', updateParkingAvailability);

module.exports = router;