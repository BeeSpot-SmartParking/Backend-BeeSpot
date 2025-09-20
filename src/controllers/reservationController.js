const { pool } = require('../config/database');
const { updateParkingDetails } = require('./parkingController');

// Generate simple confirmation code
const generateConfirmationCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

// Generate simple QR code data (just text for now)
const generateQRCode = (reservationId, confirmationCode) => {
  return `SMARTPARKING-${reservationId}-${confirmationCode}`;
};

// Create new reservation (basic version)
const createReservation = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      userEmail,  // Since no auth, we'll use email to identify user
      matricule,  // License plate
      parkingLocationId,
      reservationStart,
      reservationEnd,
      parkingSpotId = null
    } = req.body;

    // Basic validation
    if (!userEmail || !matricule || !parkingLocationId || !reservationStart || !reservationEnd) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, matricule, parkingLocationId, reservationStart, reservationEnd'
      });
    }

    // Validate dates
    const startDate = new Date(reservationStart);
    const endDate = new Date(reservationEnd);
    const now = new Date();

    if (startDate < now) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Reservation start time must be in the future'
      });
    }

    if (endDate <= startDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Reservation end time must be after start time'
      });
    }

    // Check if parking location exists and has availability
    const parkingResult = await client.query(`
      SELECT id, name, price_per_hour, available_spots, total_spots, parking_type
      FROM parking_locations
      WHERE id = $1 AND is_active = true
    `, [parkingLocationId]);

    if (parkingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Parking location not found or inactive'
      });
    }

    const parkingLocation = parkingResult.rows[0];

    if (parkingLocation.available_spots <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No available spots at this parking location'
      });
    }

    // Calculate duration and cost
    const durationMs = endDate - startDate;
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
    const totalAmount = durationHours * parkingLocation.price_per_hour;

    // For organized parking, try to assign a specific spot
    let assignedSpotId = parkingSpotId;
    if (parkingLocation.parking_type === 'organized' && !parkingSpotId) {
      const availableSpot = await client.query(`
        SELECT id FROM parking_spots
        WHERE parking_location_id = $1 AND is_available = true
        LIMIT 1
      `, [parkingLocationId]);

      if (availableSpot.rows.length > 0) {
        assignedSpotId = availableSpot.rows[0].id;
      }
    }

    // Generate confirmation code and QR code
    const confirmationCode = generateConfirmationCode();

    // Create reservation
    const reservationResult = await client.query(`
      INSERT INTO reservations (
        parking_location_id, parking_spot_id,
        reservation_start, reservation_end,
        base_amount_dzd, total_amount_dzd,
        confirmation_code, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
      RETURNING id, created_at
    `, [
      parkingLocationId, assignedSpotId,
      reservationStart, reservationEnd,
      totalAmount, totalAmount,
      confirmationCode
    ]);

    const reservation = reservationResult.rows[0];
    const qrCode = generateQRCode(reservation.id, confirmationCode);

    // Update QR code in reservation
    await client.query(`
      UPDATE reservations SET qr_code = $1 WHERE id = $2
    `, [qrCode, reservation.id]);

    // Update parking location availability
    await client.query(`
      UPDATE parking_locations
      SET available_spots = available_spots - 1
      WHERE id = $1
    `, [parkingLocationId]);

    // If a specific spot was assigned, mark it as unavailable
    if (assignedSpotId) {
      await client.query(`
        UPDATE parking_spots
        SET is_available = false
        WHERE id = $1
      `, [assignedSpotId]);
    }

    await client.query('COMMIT');

    // Return reservation details
    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      data: {
        reservationId: reservation.id,
        confirmationCode,
        qrCode,
        userEmail,
        matricule,
        parkingLocation: {
          id: parkingLocation.id,
          name: parkingLocation.name
        },
        spotId: assignedSpotId,
        reservationStart,
        reservationEnd,
        durationHours,
        totalAmount,
        status: 'confirmed',
        createdAt: reservation.created_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create reservation'
    });
  } finally {
    client.release();
  }
};

// Get reservation by confirmation code
const getReservationByCode = async (req, res) => {
  try {
    const { confirmationCode } = req.params;
    
    console.log('Searching for confirmation code:', confirmationCode);

    const result = await pool.query(`
      SELECT r.*, pl.name as parking_name, pl.address, pl.wilaya,
             ps.spot_number
      FROM reservations r
      JOIN parking_locations pl ON r.parking_location_id = pl.id
      LEFT JOIN parking_spots ps ON r.parking_spot_id = ps.id
      WHERE r.confirmation_code = $1
    `, [confirmationCode]);

    console.log('Query result:', result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get reservation by code error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reservation',
      details: error.message // Add for debugging
    });
  }
};

// Get all reservations (basic version)
const getAllReservations = async (req, res) => {
  try {
    const { status, parkingLocationId } = req.query;

    let query = `
      SELECT r.*, pl.name as parking_name, pl.address, pl.wilaya,
             ps.spot_number
      FROM reservations r
      JOIN parking_locations pl ON r.parking_location_id = pl.id
      LEFT JOIN parking_spots ps ON r.parking_spot_id = ps.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (parkingLocationId) {
      paramCount++;
      query += ` AND r.parking_location_id = $${paramCount}`;
      queryParams.push(parkingLocationId);
    }

    query += ` ORDER BY r.created_at DESC LIMIT 100`;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Get all reservations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reservations'
    });
  }
};

// Cancel reservation
const cancelReservation = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get reservation details
    const reservationResult = await client.query(`
      SELECT r.*, pl.available_spots, pl.total_spots
      FROM reservations r
      JOIN parking_locations pl ON r.parking_location_id = pl.id
      WHERE r.id = $1
    `, [id]);

    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }

    const reservation = reservationResult.rows[0];

    if (reservation.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Reservation is already cancelled'
      });
    }

    if (reservation.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel completed reservation'
      });
    }

    // Update reservation status
    await client.query(`
      UPDATE reservations
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Restore parking location availability
    await client.query(`
      UPDATE parking_locations
      SET available_spots = available_spots + 1
      WHERE id = $1
    `, [reservation.parking_location_id]);

    // If specific spot was assigned, mark it as available
    if (reservation.parking_spot_id) {
      await client.query(`
        UPDATE parking_spots
        SET is_available = true
        WHERE id = $1
      `, [reservation.parking_spot_id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
      reservationId: id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel reservation'
    });
  } finally {
    client.release();
  }
};

// NEW: Complete a reservation
const completeReservation = async (req, res) => {
  const client = await pool.connect();
  console.log("hey");
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get reservation details and lock the row for the transaction
    const reservationResult = await client.query(`
      SELECT r.*, pl.available_spots, pl.total_spots
      FROM reservations r
      JOIN parking_locations pl ON r.parking_location_id = pl.id
      WHERE r.id = $1 FOR UPDATE
    `, [id]);


    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }

    const reservation = reservationResult.rows[0];

    // Ensure the reservation is not already cancelled or completed
    if (reservation.status === 'cancelled' || reservation.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Reservation has already been ${reservation.status}`
      });
    }

    // Update reservation status
    await client.query(`
      UPDATE reservations
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Check if the spot was assigned and free it up
    if (reservation.parking_spot_id) {
      await client.query(`
        UPDATE parking_spots
        SET is_available = true
        WHERE id = $1
      `, [reservation.parking_spot_id]);
    }

    // Since a spot was 'consumed' by the reservation, we should not increment available spots here.
    // The availability should be handled at the beginning of the reservation and when it is cancelled.
    // Completing the reservation just marks the end of the booking period.

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Reservation completed successfully',
      reservationId: id,
      newStatus: 'completed'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete reservation'
    });
  } finally {
    client.release();
  }
};


const updateReservationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const query = 'UPDATE reservations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [status, id]);
    if (result.rows.length > 0) {
      res.status(200).json({
        message: 'Reservation status updated successfully!',
        reservation: result.rows[0]
      });
    } else {
      res.status(404).json({ message: 'Reservation not found' });
    }
  } catch (err) {
    console.error('Error updating reservation status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



const getReservationsByUserId = async (req, res) => {
  const { userId } = req.params;
  try {
    const query = 'SELECT * FROM reservations WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [userId]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching reservations by user ID:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};




const generateQRCodeData = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'SELECT id, user_id, parking_id, start_time, end_time FROM reservations WHERE id = $1';
    const result = await pool.query(query, [id]);
    if (result.rows.length > 0) {
      const reservationData = result.rows[0];
      // Create a unique string to represent the reservation
      const qrCodePayload = JSON.stringify({
        reservationId: reservationData.id,
        userId: reservationData.user_id,
        parkingId: reservationData.parking_id,
        startTime: reservationData.start_time,
        endTime: reservationData.end_time,
        // Add a signature or token for security in a real application
      });
      res.status(200).json({ qrCodeData: qrCodePayload });
    } else {
      res.status(404).json({ message: 'Reservation not found' });
    }
  } catch (err) {
    console.error('Error generating QR code data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


module.exports = {
  updateReservationStatus ,
  createReservation,
  getReservationByCode,
  getAllReservations,
  cancelReservation,
  completeReservation,
  getReservationsByUserId,
  generateQRCodeData
};
