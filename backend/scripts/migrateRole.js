const pool = require('../src/config/db');

const email = process.argv[2]?.trim().toLowerCase();

const migrate = async () => {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'");
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)');
    console.log('The required users columns are available.');

    if (email) {
      const result = await pool.query(
        "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING email, role",
        [email]
      );
      if (!result.rows[0]) throw new Error(`No account found for ${email}.`);
      console.log(`Promoted ${result.rows[0].email} to ${result.rows[0].role}.`);
    }
  } finally {
    await pool.end();
  }
};

migrate().catch((error) => {
  console.error(`Role migration failed: ${error.message}`);
  process.exitCode = 1;
});
