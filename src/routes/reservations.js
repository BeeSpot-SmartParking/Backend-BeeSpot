

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
//working correctly

// Get all reservations (with optional filters)
router.get('/', getAllReservations);
//working correctly

// Get specific reservation by confirmation code
router.get('/code/:confirmationCode', getReservationByCode);
//working 

// Cancel reservation
router.put('/:id/cancel', cancelReservation);
router.patch('/:id/cancel', cancelReservation);

// NEW: Complete a reservation
router.put('/:id/complete', completeReservation);
router.patch('/:id/complete', completeReservation);

module.exports = router;
