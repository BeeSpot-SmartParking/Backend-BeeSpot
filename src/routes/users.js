const express = require('express');
const router = express.Router();
const {
  registerUser,
  getUserByEmail
} = require('../controllers/usersController');

// Register a new user
router.post('/', registerUser);

// Get user details by email
router.get('/email/:email', getUserByEmail);

module.exports = router;
