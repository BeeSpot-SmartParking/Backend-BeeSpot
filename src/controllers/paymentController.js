const { pool } = require('../config/database');
require('dotenv').config();

// Step 1: Initiate payment

const initiatePayment = async (req, res) => {
  console.log("Initiate payment called");
  console.log("Request body:", req.body);
  const { reservation_id } = req.body;

  try {
    // 1. Get reservation info from DB
    const result = await pool.query(
      'SELECT r.id, r.reservation_start, r.reservation_end, p.price_per_hour FROM reservations r JOIN parking_locations p ON r.parking_location_id = p.id WHERE r.id = $1',
      [reservation_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = result.rows[0];

    // Calculate hours from start/end times
    const startTime = new Date(reservation.reservation_start);
    const endTime = new Date(reservation.reservation_end);
    const durationMs = endTime - startTime;
    const hours = Math.ceil(durationMs / (1000 * 60 * 60)); 

    const amount = hours * reservation.price_per_hour;

    // 2. Call Guiddini initiate API
    const response = await fetch('https://epay.guiddini.dz/api/payment/initiate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-app-key': process.env.GUIDDINI_APP_KEY,
        'x-app-secret': process.env.GUIDDINI_SECRET_KEY
      },
      body: JSON.stringify({
        amount: amount.toString(),
        language: 'fr'
      })
    });
    console.log("Guiddini response status:", response.status);
    console.log("response.data:", response.data);
    const data = await response.json();

    if (!data.data || !data.data.attributes.form_url) {
      return res.status(500).json({ error: 'Failed to initiate payment', details: data });
    }

    // 3. Return the payment URL to frontend
    res.status(200).json({
      message: 'Payment initiated',
      order_number: data.data.id,
      amount,
      payment_url: data.data.attributes.form_url
    });

  } catch (err) {
    console.error('Error initiating payment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Step 2: Verify payment after user completes payment
const verifyPayment = async (req, res) => {
  const { order_number, reservation_id } = req.body;

  try {
    // 1. Call Guiddini show API
    const response = await fetch('https://epay.guiddini.dz/api/payment/show', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-app-key': process.env.GUIDDINI_APP_KEY,
        'x-app-secret': process.env.GUIDDINI_SECRET_KEY
      },
      body: JSON.stringify({ order_number }) // some APIs expect query params, double-check
    });

    const data = await response.json();

    if (!data.data) {
      return res.status(400).json({ error: 'Payment not found', details: data });
    }

    const paymentStatus = data.data.attributes.status;

    // 2. Update reservation if payment successful
    if (paymentStatus === 'successful') {
      await pool.query(
        'UPDATE reservations SET status = ?, payment_order = ? WHERE id = ?',
        ['paid', order_number, reservation_id]
      );
    }

    // 3. Return payment details to frontend
    res.status(200).json({
      message: 'Payment verification complete',
      status: paymentStatus,
      details: data.data.attributes
    });

  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  initiatePayment,
  verifyPayment
};
