const { pool } = require('../config/database');




const getCompanyAnalytics = async (req, res) => {
  const { companyId } = req.params;
  console.log('Fetching analytics for company ID:', companyId); 
  
  try {
    console.log('Step 1: Getting total spots...');
    const totalSpots = await pool.query('SELECT SUM(total_spots) FROM parking_locations WHERE company_id = $1', [companyId]);
    console.log('Total spots result:', totalSpots.rows);
    
    if (totalSpots.rows.length === 0 || totalSpots.rows[0].sum === null) {
      return res.status(404).json({ error: 'Company not found or has no parking locations' });
    }
    
    console.log('Step 2: Getting total reservations...');
    // Check if reservations table exists first
    const totalReservations = await pool.query(`
      SELECT COUNT(r.*) FROM reservations r
      JOIN parking_locations p ON r.parking_location_id = p.id
      WHERE p.company_id = $1
    `, [companyId]);
    console.log('Total reservations result:', totalReservations.rows);

    console.log('Step 3: Getting daily reservations...');
    const dailyReservations = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM reservations
      JOIN parking_locations ON reservations.parking_location_id = parking_locations.id
      WHERE parking_locations.company_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [companyId]);
    console.log('Daily reservations result:', dailyReservations.rows);

    res.status(200).json({
      totalSpots: parseInt(totalSpots.rows[0].sum, 10) || 0,
      totalReservations: parseInt(totalReservations.rows[0].count, 10),
      dailyReservations: dailyReservations.rows,
    });
    
  } catch (err) {
    console.error('Detailed error in getCompanyAnalytics:', err);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message // Add this for debugging
    });
  }
};

// New mock function for sensor data
const getParkingSensorData = async (req, res) => {
  const { parkingId } = req.params;
  try {
    const mockSensorData = {
      parkingId: parkingId,
      emptySpots: Math.floor(Math.random() * 50),
      occupiedSpots: Math.floor(Math.random() * 50),
      // In a real application, this would come from a live sensor feed
      unauthorizedVehicles: Math.random() > 0.9 ? Math.floor(Math.random() * 3) : 0,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(mockSensorData);
  } catch (err) {
    console.error('Error fetching sensor data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDashboardMetrics = async (req, res) => {
  try {
    const [
      totalUsersResult,
      totalParkingLocationsResult,
      totalReservationsResult,
      activeLocationsResult,
      reservationStatusCountsResult,
      totalRevenueResult,
      recentReservationsResult,
      recentParkingLocationsResult,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total_users FROM users`),
      pool.query(`SELECT COUNT(*)::int AS total_locations FROM parking_locations`),
      pool.query(`SELECT COUNT(*)::int AS total_reservations FROM reservations`),
      pool.query(`SELECT COUNT(*)::int AS active_locations FROM parking_locations WHERE is_active = true`),
      pool.query(`SELECT status, COUNT(*)::int FROM reservations GROUP BY status`),
      pool.query(`SELECT SUM(total_amount_dzd)::float AS total_revenue FROM reservations WHERE status = 'completed'`),
      pool.query(`
        SELECT r.id, r.created_at, r.status, r.total_amount_dzd, pl.name as parking_name
        FROM reservations r
        JOIN parking_locations pl ON r.parking_location_id = pl.id
        ORDER BY r.created_at DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT id, name, available_spots, total_spots, is_active, created_at
        FROM parking_locations
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ]);

    const metrics = {
      totalUsers: totalUsersResult.rows[0].total_users,
      totalParkingLocations: totalParkingLocationsResult.rows[0].total_locations,
      totalReservations: totalReservationsResult.rows[0].total_reservations,
      activeParkingLocations: activeLocationsResult.rows[0].active_locations,
      totalRevenueDZD: totalRevenueResult.rows[0].total_revenue || 0,
      reservationStatusCounts: reservationStatusCountsResult.rows.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {}),
      recentReservations: recentReservationsResult.rows,
      recentParkingLocations: recentParkingLocationsResult.rows,
    };

    res.json({
      success: true,
      data: metrics,
    });

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard metrics.'
    });
  }
};

module.exports = {
    getDashboardMetrics,
  getCompanyAnalytics,
  getParkingSensorData,
};
