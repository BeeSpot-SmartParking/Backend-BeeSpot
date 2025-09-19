const { pool } = require('../config/database');

// Create a new user account (basic version, no password hashing or auth)
const registerUser = async (req, res) => {
  try {
    const { username, email, phone, password = 'temp_password', isCompany = false } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        error: 'Username and email are required fields.'
      });
    }

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, phone, is_company, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, username, email, phone, is_company`,
      [username, email, password, phone, isCompany]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result.rows[0],
    });

  } catch (error) {
    console.error('User registration error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'A user with this email already exists.'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to register user.'
    });
  }
};

// Get a user by their email
const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const result = await pool.query(
      `SELECT id, username, email, phone, is_company, created_at FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get user by email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details.'
    });
  }
};

module.exports = {
  registerUser,
  getUserByEmail,
};
