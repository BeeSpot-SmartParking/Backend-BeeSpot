const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.DB_CONNECTION_STRING;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL or DB_CONNECTION_STRING environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,                    // Reduced max connections
  idleTimeoutMillis: 10000,   // Reduced idle timeout
  connectionTimeoutMillis: 10000, // Increased connection timeout
  statement_timeout: 30000,   // Increased statement timeout
  query_timeout: 30000,       // Increased query timeout
  keepAlive: true,           // Keep connections alive
  keepAliveInitialDelayMillis: 10000
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

pool.on('connect', (client) => {
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
