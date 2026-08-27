const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');

const setRefreshCookie = (res, token) => res.cookie('refreshToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });

exports.signup = async (req, res, next) => {
  const { name, email, password } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if ((await client.query('SELECT id FROM users WHERE email = $1', [email])).rows[0]) throw Object.assign(new Error('Email already registered'), { statusCode: 409, isOperational: true });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await client.query("INSERT INTO email_otps (email, otp_hash, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '10 minutes')", [email, await bcrypt.hash(otp, 12)]);
    const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
    if (smtpKeys.every((key) => process.env[key])) {
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
      await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject: 'Your VeloSync OTP', text: `Your VeloSync verification code is ${otp}. It expires in 10 minutes.` });
    } else if (process.env.SHOW_TEST_OTP !== 'true') throw Object.assign(new Error('Email delivery is not configured.'), { statusCode: 503, isOperational: true });
    await client.query('COMMIT');
    res.json({ success: true, message: 'OTP sent to email.', ...(process.env.SHOW_TEST_OTP === 'true' ? { testOtp: otp } : {}) });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
};

exports.verifyOtp = async (req, res, next) => {
  const { name, email, password, otp } = req.body;
  if (!name || !email || !password || !/^\d{6}$/.test(otp || '')) return res.status(422).json({ success: false, message: 'Name, email, password, and a 6-digit OTP are required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const otpRecord = await client.query('SELECT id, otp_hash FROM email_otps WHERE email = $1 AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [email]);
    if (!otpRecord.rows[0] || !(await bcrypt.compare(otp, otpRecord.rows[0].otp_hash))) throw Object.assign(new Error('OTP expired or invalid.'), { statusCode: 400, isOperational: true });
    const user = await client.query('INSERT INTO users (name, email, password_hash, is_email_verified) VALUES ($1, $2, $3, TRUE) RETURNING id, name, email', [name, email, await bcrypt.hash(password, 12)]);
    await client.query('UPDATE email_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1', [otpRecord.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Account created successfully.', user: user.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
};

exports.login = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, email, password_hash, wallet_balance FROM users WHERE email = $1', [req.body.email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await pool.query("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '7 days')", [user.id, refreshToken]);
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, accessToken, user: { id: user.id, name: user.name, email: user.email, wallet: user.wallet_balance } });
  } catch (error) { next(error); }
};

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const tokenResult = await pool.query('SELECT 1 FROM refresh_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP', [token]);
    const user = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.id]);
    if (!tokenResult.rows[0] || !user.rows[0]) return res.status(403).json({ success: false, message: 'Invalid refresh token' });
    res.json({ success: true, accessToken: generateAccessToken(user.rows[0]) });
  } catch { res.status(403).json({ success: false, message: 'Invalid or expired refresh token' }); }
};

exports.logout = async (req, res, next) => { try { if (req.cookies.refreshToken) await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [req.cookies.refreshToken]); res.clearCookie('refreshToken'); res.json({ success: true, message: 'Logged out successfully' }); } catch (error) { next(error); } };
exports.getMe = async (req, res, next) => { try { const result = await pool.query('SELECT id, name, email, wallet_balance, created_at FROM users WHERE id = $1', [req.user.id]); if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' }); res.json({ success: true, user: result.rows[0] }); } catch (error) { next(error); } };
