const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Use env variable
  ssl: {
    rejectUnauthorized: false, // required for Neon
  },
});

module.exports = { pool };
