const { Pool } = require('pg');
require('dotenv').config();

// Parse the single connection string from the environment variables
const connectionString = process.env.DB_CONNECTION_STRING;

if (!connectionString) {
  console.error('Error: DB_CONNECTION_STRING environment variable is not set.');
  process.exit(1);
}

// Create a connection pool using the single connection string
const pool = new Pool({
  connectionString: connectionString,
});

// A simple query to test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Database connection successful at:', res.rows[0].now);
  }
});

module.exports = {
  pool,
};
