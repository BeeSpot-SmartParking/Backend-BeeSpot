const { pool } = require('../config/database');

// Simulate a payment with Baridi Mob
const processPayment = async (req, res) => {
  const { company_id, amount, payment_token } = req.body;

  try {
    // In a real application, you would connect to the Baridi Mob API here
    // For this example, we'll simulate a successful payment based on a mock token
    if (!payment_token || payment_token !== 'mock-baridi-mob-token') {
      return res.status(400).json({ error: 'Invalid payment token.' });
    }

    // After a successful payment, update the company's subscription to 'pro'
    // This calls a function in the companyController to perform the database update
    const { updateCompanyToPro } = require('./companyController');
    const result = await updateCompanyToPro(company_id);

    if (result) {
      res.status(200).json({
        message: 'Payment successful and company upgraded to pro!',
        company: result
      });
    } else {
      res.status(500).json({ error: 'Payment successful, but failed to update company status.' });
    }
  } catch (err) {
    console.error('Error processing payment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  processPayment,
};
