// src/routes/reservations.js - Basic reservation routes (no authentication)

const express = require('express');
const router = express.Router();

const {
  createReservation,
  getReservationByCode,
  getAllReservations,
  cancelReservation,
  completeReservation
} = require('../controllers/reservationController');

// Create new reservation
router.post('/', createReservation);

// Get all reservations (with optional filters)
router.get('/', getAllReservations);

// Get specific reservation by confirmation code
router.get('/code/:confirmationCode', getReservationByCode);

// Cancel reservation
router.put('/:id/cancel', cancelReservation);
router.patch('/:id/cancel', cancelReservation);

// NEW: Complete a reservation
router.put('/:id/complete', completeReservation);
router.patch('/:id/complete', completeReservation);

module.exports = router;
