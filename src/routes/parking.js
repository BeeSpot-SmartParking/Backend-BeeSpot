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
  getAvailableWilayas,
  updateParkingDetails,
  deleteParkingLocation,
  getParkingSpots,
  updateParkingSpotAvailability
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

// NEW: Update specific parking location details
router.put('/:id', updateParkingDetails);
router.patch('/:id', updateParkingDetails);

// NEW: Delete a parking location
router.delete('/:id', deleteParkingLocation);

// Add new parking location
router.post('/', addParkingLocation);

// Update parking availability (full location)
router.put('/:id/availability', updateParkingAvailability);

// NEW: Get all spots for a specific parking location
router.get('/:parkingId/spots', getParkingSpots);

// NEW: Update a specific parking spot's availability
router.put('/spots/:id/availability', updateParkingSpotAvailability);
router.patch('/spots/:id/availability', updateParkingSpotAvailability);

module.exports = router;
