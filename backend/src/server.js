const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('./config/db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// --- SMTP CONFIG ---
const smtpConfigKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
const missingSmtpConfig = smtpConfigKeys.filter((key) => !process.env[key]);
const transporter = missingSmtpConfig.length === 0
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    })
  : null;

// --- SOCKET.IO ---
io.on('connection', (socket) => {
  console.log('Client connected for real-time updates');
});

// --- AUTHENTICATION APIS ---
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const showTestOtp = process.env.SHOW_TEST_OTP === 'true';
  let client;
  try {
    if (!name || !email || !password) {
      return res.status(422).json({ success: false, message: 'Name, email, and password are required.' });
    }

    if (!transporter && !showTestOtp) {
      return res.status(503).json({
        success: false,
        message: `Email delivery is not configured. Missing: ${missingSmtpConfig.join(', ')}.`
      });
    }

    client = await pool.connect();
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

    await client.query('BEGIN');
    await client.query('INSERT INTO email_otps (email, otp_hash, expires_at) VALUES ($1, $2, $3)', [email, otpHash, expiresAt]);
    
    if (!showTestOtp) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Your VeloSync OTP',
        text: `Your VeloSync verification code is ${otp}. It expires in 10 minutes.`
      });
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'OTP sent to email.',
      ...(showTestOtp ? { testOtp: otp } : {})
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Unable to send signup OTP:', error);
    res.status(502).json({ success: false, message: 'Unable to send the OTP email. Check the SMTP settings and try again.' });
  } finally {
    client?.release();
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { name, email, password, otp } = req.body;
  try {
    const otpRecord = await pool.query('SELECT * FROM email_otps WHERE email = $1 ORDER BY expires_at DESC LIMIT 1', [email]);
    if (otpRecord.rows.length === 0 || new Date() > otpRecord.rows[0].expires_at) {
      return res.status(400).json({ success: false, message: 'OTP expired or invalid.' });
    }
    
    const isValid = await bcrypt.compare(otp, otpRecord.rows[0].otp_hash);
    if (!isValid) return res.status(400).json({ success: false, message: 'Incorrect OTP.' });

    const passHash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (full_name, email, password_hash, is_email_verified) VALUES ($1, $2, $3, true)', [name, email, passHash]);
    
    res.json({ success: true, message: 'Account created successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    
    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, token, user: { id: user.id, name: user.full_name, wallet: user.wallet_balance } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) { res.status(401).json({ success: false, message: 'Invalid Token' }); }
};

// --- BICYCLE & RIDE APIS ---
app.get('/api/bikes', async (req, res) => {
  try {
    // GeoJSON formatting directly from PostGIS
    const result = await pool.query(`
      SELECT id, battery_level, network_status, is_locked, ST_Y(geom) as lat, ST_X(geom) as lng 
      FROM bicycles WHERE is_locked = TRUE AND health = 'Good'
    `);
    res.json({ success: true, bikes: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/rides/start', protect, async (req, res) => {
  const { bikeId } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verify wallet > ₹50[cite: 3, 10]
    const userRes = await client.query('SELECT wallet_balance FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows[0].wallet_balance < 50) throw new Error('Insufficient funds. Min ₹50 required.');

    // Concurrency check: SKIP LOCKED prevents double booking[cite: 8, 10]
    const bikeRes = await client.query(`
      SELECT id FROM bicycles WHERE id = $1 AND is_locked = TRUE LIMIT 1 FOR UPDATE SKIP LOCKED
    `, [bikeId]);
    if (bikeRes.rows.length === 0) throw new Error('Bike not available or already rented.');

    const tripRes = await client.query('INSERT INTO trips (user_id, bicycle_id) VALUES ($1, $2) RETURNING id', [req.user.id, bikeId]);
    await client.query('UPDATE bicycles SET is_locked = FALSE, current_station_id = NULL WHERE id = $1', [bikeId]);
    
    await client.query('COMMIT');
    io.emit('bike:updated', { bikeId, is_locked: false }); // Real-time update
    res.json({ success: true, tripId: tripRes.rows[0].id, message: 'Bike Unlocked!' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/rides/end', protect, async (req, res) => {
  const { tripId, bikeId, lat, lng } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // ST_DWithin checks if bike is inside ANY station polygon (Geofencing)[cite: 8, 10]
    const stationRes = await client.query(`
      SELECT id FROM stations 
      WHERE ST_DWithin(geom, ST_MakePoint($1, $2)::geography, 50) LIMIT 1
    `, [lng, lat]);
    
    if (stationRes.rows.length === 0) throw new Error('Cannot end ride: Not inside a valid VeloSync geofenced station.');
    const stationId = stationRes.rows[0].id;
    const fare = 15.00; // Mock fare

    await client.query('UPDATE trips SET end_time = CURRENT_TIMESTAMP, fare = $1, status = $2 WHERE id = $3', [fare, 'COMPLETED', tripId]);
    await client.query('UPDATE bicycles SET is_locked = TRUE, current_station_id = $1, geom = ST_MakePoint($2, $3) WHERE id = $4', [stationId, lng, lat, bikeId]);
    await client.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [fare, req.user.id]);

    await client.query('COMMIT');
    io.emit('bike:updated', { bikeId, is_locked: true, lat, lng });
    res.json({ success: true, message: 'Ride completed successfully.', fare });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// --- IOT SIMULATOR ABSTRACTION (Simulating ESP32 Telemetry) ---
app.post('/api/iot/devices/:deviceId/telemetry', async (req, res) => {
  const { deviceId } = req.params;
  const { lat, lng, battery, network, isLocked } = req.body;
  
  try {
    await pool.query(`
      UPDATE bicycles 
      SET geom = ST_MakePoint($1, $2), battery_level = $3, network_status = $4, is_locked = $5
      WHERE id = $6
    `, [lng, lat, battery, network, isLocked, deviceId]);

    // Emit live telemetry to map and users
    io.emit('bike:telemetry', { bikeId: deviceId, lat, lng, battery, network, isLocked });
    res.json({ success: true, message: 'Telemetry processed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`🚀 VeloSync Backend on port ${port}`));
