const express = require('express');
const router = express.Router();
const {
  registerCompany,
  getCompanyById,
  getCompanyParkingLocations
} = require('../controllers/companyController');

// Register a new company
router.post('/', registerCompany);

// Get company details by ID
router.get('/:id', getCompanyById);

// Get all parking locations for a specific company
router.get('/:companyId/parking-locations', getCompanyParkingLocations);

module.exports = router;
