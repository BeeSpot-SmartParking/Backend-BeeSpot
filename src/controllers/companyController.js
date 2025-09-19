const { pool } = require('../config/database');

// Register a new company account (basic version)
const registerCompany = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { companyName, email, password = null, phone, address, wilaya, commune } = req.body;

    if (!companyName || !email) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Company name and email are required fields.'
      });
    }

    // Step 1: Create a user account for the company (is_company = true)
    const userResult = await client.query(
      `INSERT INTO users (username, email, password, phone, is_company, created_at) VALUES ($1, $2, $3, $4, true, NOW()) RETURNING id`,
      [companyName, email, password, phone]
    );
    const userId = userResult.rows[0].id;

    // Step 2: Create the company entry linked to the new user ID
    const companyResult = await client.query(
      `INSERT INTO companies (user_id, company_name, email, phone, address, wilaya, commune, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [userId, companyName, email, phone, address, wilaya, commune]
    );
    const companyId = companyResult.rows[0].id;

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Company registered successfully',
      data: {
        companyId,
        userId,
        companyName,
        email
      },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Company registration error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'A company with this email already exists.'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to register company.'
    });
  } finally {
    client.release();
  }
};

// Get a company by their ID
const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, company_name, email, phone, address, wilaya, commune, created_at FROM companies WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company not found.'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get company by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company details.'
    });
  }
};

// Get all parking locations for a specific company
const getCompanyParkingLocations = async (req, res) => {
  try {
    const { companyId } = req.params;

    const result = await pool.query(
      `SELECT * FROM parking_locations WHERE company_id = $1 ORDER BY name`,
      [companyId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Get company parking locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company parking locations.'
    });
  }
};

module.exports = {
  registerCompany,
  getCompanyById,
  getCompanyParkingLocations,
};
