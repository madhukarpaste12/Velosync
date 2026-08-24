const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');

// Helper to set cookie
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

exports.signup = async (req, res, next) => {
  const { name, email, password } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if user exists
    const userExists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Insert User
    const result = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );
    const user = result.rows[0];

    // 4. Generate Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 5. Store Refresh Token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    await client.query('COMMIT');

    // 6. Send Response
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, message: 'Account created', accessToken, user });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // 1. Find User
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 2. Verify Password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 3. Generate Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 4. Update/Store Refresh Token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    setRefreshCookie(res, refreshToken);
    
    // 5. Return safe user data
    res.status(200).json({
      success: true,
      accessToken,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });

  try {
    // Verify token cryptographically
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Verify token exists in database (hasn't been revoked/logged out)
    const result = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
    if (result.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Invalid refresh token' });
    }

    // Generate new Access Token
    const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.id]);
    const accessToken = generateAccessToken(userRes.rows[0]);

    res.status(200).json({ success: true, accessToken });
  } catch (error) {
    res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

exports.logout = async (req, res, next) => {
  const { refreshToken } = req.cookies;

  try {
    if (refreshToken) {
      // Remove token from database to invalidate it completely
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    
    // Clear the HTTP-only cookie
    res.clearCookie('refreshToken');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    
    res.status(200).json({ success: true, user: result.rows[0] });
  } catch (error) {
    next(error);
  }
};