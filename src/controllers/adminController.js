const { pool } = require('../config/database');

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
};
