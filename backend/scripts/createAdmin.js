const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');

const run = async () => {
  if (!email || !password || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in backend/.env.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_email_verified)
     VALUES ('VeloSync Admin', $1, $2, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_email_verified = TRUE
     RETURNING id, email, role`,
    [email, passwordHash]
  );
  console.log(`Administrator provisioned: ${result.rows[0].email} (${result.rows[0].role})`);
};

run().catch((error) => {
  console.error(`Unable to provision administrator: ${error.message}`);
  process.exitCode = 1;
}).finally(() => pool.end());
