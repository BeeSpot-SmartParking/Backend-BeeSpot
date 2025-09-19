const { pool } = require('../config/database');

const processParkingExit = async (req, res) => {
  const { licensePlate } = req.body;

  if (!licensePlate) {
    return res.status(400).json({ error: 'License plate is required.' });
  }

  try {
    // 1. Find the vehicle's most recent entry from the database
    const entryQuery = `
      SELECT id, user_id, start_time, end_time
      FROM reservations
      WHERE license_plate = $1 AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `;
    const entryResult = await pool.query(entryQuery, [licensePlate]);

    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active entry found for this license plate.' });
    }

    const entryRecord = entryResult.rows[0];
    const entryTime = new Date(entryRecord.start_time);
    const exitTime = new Date();
    const durationInHours = (exitTime - entryTime) / (1000 * 60 * 60);

    // 2. Check for an online reservation
    const reservationQuery = `
      SELECT end_time
      FROM reservations
      WHERE user_id = $1
      AND start_time <= $2 AND end_time >= $2
    `;
    const reservationResult = await pool.query(reservationQuery, [entryRecord.user_id, entryTime]);

    let finalCost = 0;
    let message = '';
    let status = 'unpaid';

    if (reservationResult.rows.length > 0) {
      // User has an online reservation
      const reservedEndTime = new Date(reservationResult.rows[0].end_time);

      if (exitTime > reservedEndTime) {
        const overstayInMinutes = (exitTime - reservedEndTime) / (1000 * 60);
        
        // This is where you would calculate the punishment/penalty fee
        // For example:
        // const penaltyFee = overstayInMinutes * 0.5; // 0.5 DZD per minute overstay
        
        message = `You have overstayed your reservation by ${Math.round(overstayInMinutes)} minutes. An overstay penalty may be applied.`;
        status = 'overstay';
        finalCost = 0; // The penalty fee would be handled in a separate transaction
        console.log(message);
      } else {
        message = 'Thank you. Your online reservation is complete.';
        status = 'paid';
        finalCost = 0;
      }
    } else {
      // User did not pay online, calculate cost based on time spent
      finalCost = durationInHours * 100; // Example: 100 DZD per hour
      message = `Your parking duration is ${durationInHours.toFixed(2)} hours. Your total due is ${finalCost.toFixed(2)} DZD.`;
      status = 'unpaid';
    }

    // 3. Update the exit time in the database
    const updateQuery = `
      UPDATE reservations
      SET end_time = $1
      WHERE id = $2
      RETURNING *
    `;
    await pool.query(updateQuery, [exitTime, entryRecord.id]);

    res.status(200).json({
      message,
      finalCost,
      durationInHours: durationInHours.toFixed(2),
      status,
    });

  } catch (err) {
    console.error('Error processing parking exit:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  processParkingExit,
};
