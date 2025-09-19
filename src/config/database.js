const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout
  statement_timeout: 10000,
  query_timeout: 10000,
  retry: {
    match: [
      /connection timeout/,
      /Connection terminated/,
      /Connection terminated unexpectedly/
    ],
    max: 3
  }
});

// Improved connection testing with retries
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('✅ Database connected successfully at:', result.rows[0].now);
      client.release();
      return true;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      if (i === retries - 1) {
        console.error('All connection attempts failed');
        throw err;
      }
      // Wait for 2 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Event handlers for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('New client connected to the pool');
});

// Only test connection if this file is run directly
if (require.main === module) {
  testConnection()
    .catch(() => process.exit(1));
}

module.exports = {
  pool,
  testConnection
};
