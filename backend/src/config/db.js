const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const requiredConfig = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingConfig = requiredConfig.filter((key) => !process.env[key]);

if (missingConfig.length > 0) {
  throw new Error(`Missing database configuration: ${missingConfig.join(', ')}. Copy backend/.env.example to backend/.env and fill in the values.`);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
  max: 9, // Assumes a 4-core CPU: (4 * 2) + 1[cite: 10]
  idleTimeoutMillis: 30000
});

pool.connect((err, client, release) => {
  if (err) console.error('DB Connection Error:', err.stack);
  else {
    console.log('✅ Connected to VeloSync PostGIS Database');
    release();
  }
});
module.exports = pool;