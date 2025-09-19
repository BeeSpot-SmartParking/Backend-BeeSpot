// src/routes/payment.js
const express = require('express');
const router = express.Router();

// Import handlers
const { initiatePayment, verifyPayment } = require('../controllers/paymentController'); // adjust path

// Routes

// 1. Initiate a payment
router.post('/initiate', initiatePayment);

// 2. Verify a payment
router.get('/show', verifyPayment);

module.exports = router;
