const { pool } = require('../config/database');
// Get all parking locations
const getAllParkingLocations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, address, wilaya, commune,
             latitude, longitude, parking_type,
             total_spots, available_spots, price_per_hour,
             is_active, created_at
      FROM parking_locations
      WHERE is_active = true
      ORDER BY name
    `);
    console.log("hello");

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get all parking locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parking locations'
    });
  }
};

// Search parking by location (basic version)
const searchParking = async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000, maxPrice, parkingType } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    let query = `
      SELECT id, name, address, wilaya, commune,
             latitude, longitude, parking_type,
             total_spots, available_spots, price_per_hour,
             (6371 * acos(cos(radians($1)) * cos(radians(latitude))
             * cos(radians(longitude) - radians($2)) + sin(radians($1))
             * sin(radians(latitude)))) AS distance_km
      FROM parking_locations
      WHERE is_active = true
      AND available_spots > 0
      AND (6371 * acos(cos(radians($1)) * cos(radians(latitude))
            * cos(radians(longitude) - radians($2)) + sin(radians($1))
            * sin(radians(latitude)))) <= $3
    `;

    const queryParams = [parseFloat(latitude), parseFloat(longitude), radius / 1000];
    let paramCount = 3;

    // Add price filter if provided
    if (maxPrice) {
      paramCount++;
      query += ` AND price_per_hour <= $${paramCount}`;
      queryParams.push(parseFloat(maxPrice));
    }

    // Add parking type filter if provided
    if (parkingType && ['public', 'organized'].includes(parkingType)) {
      paramCount++;
      query += ` AND parking_type = $${paramCount}`;
      queryParams.push(parkingType);
    }

    query += ` ORDER BY distance_km LIMIT 20`;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      count: result.rows.length,
      searchParams: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius,
        maxPrice,
        parkingType
      },
      data: result.rows
    });

  } catch (error) {
    console.error('Search parking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search parking locations'
    });
  }
};

// Get parking location by ID
const getParkingLocationById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT pl.*, c.company_name
      FROM parking_locations pl
      LEFT JOIN companies c ON pl.company_id = c.id
      WHERE pl.id = $1 AND pl.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Parking location not found'
      });
    }

    // Also get the parking spots for this location
    const spotsResult = await pool.query(`
      SELECT id, spot_number, is_available, spot_type
      FROM parking_spots
      WHERE parking_location_id = $1
      ORDER BY spot_number
    `, [id]);

    const parkingLocation = result.rows[0];
    parkingLocation.spots = spotsResult.rows;

    res.json({
      success: true,
      data: parkingLocation
    });

  } catch (error) {
    console.error('Get parking location by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parking location details'
    });
  }
};

// Add new parking location (basic version - no auth for now)
const addParkingLocation = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name,
      address,
      wilaya,
      commune,
      latitude,
      longitude,
      parkingType,
      totalSpots,
      pricePerHour,
      companyId = null,
      spots = []
    } = req.body;

    // Basic validation
    if (!name || !address || !wilaya || !commune || !latitude || !longitude || !parkingType || !totalSpots || !pricePerHour) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const result = await client.query(`
      INSERT INTO parking_locations (
        company_id, name, address, wilaya, commune,
        latitude, longitude, parking_type, total_spots,
        available_spots, price_per_hour, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *
    `, [
      companyId, name, address, wilaya, commune,
      latitude, longitude, parkingType, totalSpots,
      totalSpots, pricePerHour  // available_spots = total_spots initially
    ]);

    const newParkingLocation = result.rows[0];
    const newLocationId = newParkingLocation.id;

    // Insert individual spots if provided
    if (spots.length > 0) {
      const spotValues = spots.map((spot) =>
        `('${newLocationId}', '${spot.spot_number}', '${spot.spot_type}')`
      ).join(',');
      await client.query(`
        INSERT INTO parking_spots (parking_location_id, spot_number, spot_type)
        VALUES ${spotValues}
      `);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Parking location and spots added successfully',
      data: newParkingLocation
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add parking location error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add parking location'
    });
  } finally {
    client.release();
  }
};

// Update parking location availability
const updateParkingAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { availableSpots } = req.body;

    if (availableSpots === undefined || availableSpots < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid available spots count is required'
      });
    }

    // Check if parking location exists
    const checkResult = await pool.query(
      'SELECT total_spots FROM parking_locations WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Parking location not found'
      });
    }

    const totalSpots = checkResult.rows[0].total_spots;

    if (availableSpots > totalSpots) {
      return res.status(400).json({
        success: false,
        error: `Available spots cannot exceed total spots (${totalSpots})`
      });
    }

    const result = await pool.query(`
      UPDATE parking_locations
      SET available_spots = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [availableSpots, id]);

    res.json({
      success: true,
      message: 'Parking availability updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update parking availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update parking availability'
    });
  }
};

// Get parking locations by wilaya
const getParkingByWilaya = async (req, res) => {
  try {
    const { wilaya } = req.params;

    const result = await pool.query(`
      SELECT id, name, address, commune,
             latitude, longitude, parking_type,
             total_spots, available_spots, price_per_hour
      FROM parking_locations
      WHERE wilaya ILIKE $1 AND is_active = true
      ORDER BY available_spots DESC, name
    `, [`%${wilaya}%`]);

    res.json({
      success: true,
      wilaya,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Get parking by wilaya error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parking locations for wilaya'
    });
  }
};

// Get all wilayas with parking locations
const getAvailableWilayas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT wilaya, COUNT(*) as parking_count
      FROM parking_locations
      WHERE is_active = true
      GROUP BY wilaya
      ORDER BY wilaya
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Get available wilayas error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available wilayas'
    });
  }
};

// NEW: Update parking location details
const updateParkingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, wilaya, commune, latitude, longitude, parkingType, totalSpots, pricePerHour } = req.body;

    const fieldsToUpdate = {};
    const queryParams = [id];
    let paramIndex = 2;

    if (name) {
      fieldsToUpdate.name = name;
      queryParams.push(name);
    }
    if (address) {
      fieldsToUpdate.address = address;
      queryParams.push(address);
    }
    if (wilaya) {
      fieldsToUpdate.wilaya = wilaya;
      queryParams.push(wilaya);
    }
    if (commune) {
      fieldsToUpdate.commune = commune;
      queryParams.push(commune);
    }
    if (latitude) {
      fieldsToUpdate.latitude = latitude;
      queryParams.push(latitude);
    }
    if (longitude) {
      fieldsToUpdate.longitude = longitude;
      queryParams.push(longitude);
    }
    if (parkingType) {
      fieldsToUpdate.parking_type = parkingType;
      queryParams.push(parkingType);
    }
    if (totalSpots) {
      fieldsToUpdate.total_spots = totalSpots;
      queryParams.push(totalSpots);
    }
    if (pricePerHour) {
      fieldsToUpdate.price_per_hour = pricePerHour;
      queryParams.push(pricePerHour);
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields provided to update'
      });
    }

    const setClause = Object.keys(fieldsToUpdate)
      .map(key => `${key} = $${paramIndex++}`)
      .join(', ');

    const result = await pool.query(
      `UPDATE parking_locations SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      queryParams
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Parking location not found'
      });
    }

    res.json({
      success: true,
      message: 'Parking location updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update parking details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update parking location'
    });
  }
};

// NEW: Delete a parking location
const deleteParkingLocation = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if location exists
    const checkResult = await client.query('SELECT id FROM parking_locations WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Parking location not found'
      });
    }

    // Delete associated parking spots first
    await client.query('DELETE FROM parking_spots WHERE parking_location_id = $1', [id]);

    // Now delete the parking location
    await client.query('DELETE FROM parking_locations WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Parking location and associated spots deleted successfully',
      id
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete parking location error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete parking location'
    });
  } finally {
    client.release();
  }
};

// NEW: Get all spots for a specific parking location
const getParkingSpots = async (req, res) => {
  try {
    const { parkingId } = req.params;
    const result = await pool.query(
      `SELECT id, spot_number, is_available, spot_type FROM parking_spots WHERE parking_location_id = $1 ORDER BY spot_number`,
      [parkingId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get parking spots error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parking spots'
    });
  }
};

// NEW: Update a specific parking spot's availability
const updateParkingSpotAvailability = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (isAvailable === undefined || typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'A boolean value for isAvailable is required'
      });
    }

    const spotResult = await client.query(
      `SELECT id, is_available, parking_location_id FROM parking_spots WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (spotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Parking spot not found'
      });
    }

    const currentSpot = spotResult.rows[0];
    const locationId = currentSpot.parking_location_id;

    if (currentSpot.is_available === isAvailable) {
      await client.query('ROLLBACK');
      return res.status(200).json({
        success: true,
        message: 'Spot availability is already at the requested state'
      });
    }

    // Update the spot's availability
    await client.query(
      `UPDATE parking_spots SET is_available = $1 WHERE id = $2`,
      [isAvailable, id]
    );

    // Update the parent parking location's available_spots count
    const change = isAvailable ? 1 : -1;
    await client.query(
      `UPDATE parking_locations SET available_spots = available_spots + $1 WHERE id = $2`,
      [change, locationId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Parking spot availability and location count updated successfully',
      spotId: id,
      newAvailability: isAvailable
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update parking spot availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update parking spot availability'
    });
  } finally {
    client.release();
  }
};

module.exports = {
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
};
