const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const { sendOtpEmail } = require('../utils/emailService');
const {
  OTP_TTL_MINUTES,
  REQUEST_COOLDOWN_MS,
  MAX_ATTEMPTS,
  OTP_PURPOSES,
  generateOtp,
  hashOtp,
  isValidOtp
} = require('../utils/otpUtils');

const setRefreshCookie = (res, token) => res.cookie('refreshToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
const operationalError = (message, statusCode) => Object.assign(new Error(message), { statusCode, isOperational: true });

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const issueOtp = async (email, purpose) => {
  const normalizedEmail = normalizeEmail(email);
  const recent = await pool.query('SELECT created_at FROM email_otps WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1', [normalizedEmail, purpose]);
  if (recent.rows[0] && Date.now() - new Date(recent.rows[0].created_at).getTime() < REQUEST_COOLDOWN_MS) {
    throw operationalError('Please wait 30 seconds before requesting another OTP.', 429);
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  await pool.query('DELETE FROM email_otps WHERE email = $1 AND purpose = $2', [normalizedEmail, purpose]);
  const inserted = await pool.query(
    "INSERT INTO email_otps (email, purpose, otp_hash, expires_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '5 minutes') RETURNING id",
    [normalizedEmail, purpose, otpHash]
  );

  try {
    await sendOtpEmail({ to: normalizedEmail, otp, purpose, expiresMinutes: OTP_TTL_MINUTES });
    // Log OTP in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n📧 OTP for ${normalizedEmail}: ${otp}\n`);
    }
  } catch (error) {
    await pool.query('DELETE FROM email_otps WHERE id = $1', [inserted.rows[0].id]);
    throw operationalError('Unable to send the verification code to your email. Please try again.', 500);
  }

  return otp;
};

exports.signup = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!name || !normalizedEmail || !req.body.password) {
      return res.status(422).json({ success: false, message: 'Name, email, and password are required.' });
    }
    if ((await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])).rows[0]) {
      throw operationalError('This user already exists. Please sign in instead.', 409);
    }
    await issueOtp(normalizedEmail, OTP_PURPOSES.SIGNUP_VERIFICATION);
    res.json({ success: true, message: 'A verification code has been sent to your email.' });
  } catch (error) { next(error); }
};

exports.verifyOtp = async (req, res, next) => {
  const { name, email, password, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);
  if (!name || !normalizedEmail || !password || !isValidOtp(otp)) {
    return res.status(422).json({ success: false, message: 'Name, email, password, and a valid 6-digit OTP are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const record = await client.query(
      'SELECT id, otp_hash, attempts FROM email_otps WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP FOR UPDATE',
      [normalizedEmail, OTP_PURPOSES.SIGNUP_VERIFICATION]
    );
    if (!record.rows[0]) throw operationalError('This verification code has expired. Please request a new one.', 400);
    if (record.rows[0].attempts >= MAX_ATTEMPTS) throw operationalError('Too many incorrect attempts. Please request a new code.', 429);
    if (!(await bcrypt.compare(otp, record.rows[0].otp_hash))) {
      await client.query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [record.rows[0].id]);
      throw operationalError('Incorrect verification code. Please try again.', 400);
    }

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows[0]) throw operationalError('This user already exists. Please sign in instead.', 409);

    const user = await client.query(
      "INSERT INTO users (name, email, password_hash, role, is_email_verified, wallet_balance) VALUES ($1, $2, $3, 'user', TRUE, 0) RETURNING id, name, email, role, wallet_balance",
      [name.trim(), normalizedEmail, await bcrypt.hash(password, 12)]
    );
    await client.query('UPDATE email_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1', [record.rows[0].id]);
    
    // Issue authentication tokens for automatic login
    const accessToken = generateAccessToken(user.rows[0]);
    const refreshToken = generateRefreshToken(user.rows[0]);
    await client.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '7 days')",
      [user.rows[0].id, refreshToken]
    );
    
    await client.query('COMMIT');
    
    // Set refresh token cookie
    setRefreshCookie(res, refreshToken);
    
    res.status(201).json({ 
      success: true, 
      message: 'OTP verified successfully. Account created.', 
      accessToken,
      user: { 
        id: user.rows[0].id, 
        name: user.rows[0].name, 
        email: user.rows[0].email, 
        role: user.rows[0].role,
        wallet: user.rows[0].wallet_balance 
      }
    });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
};

exports.requestResetOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(422).json({ success: false, message: 'Please enter your email address.' });
    }

    const user = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (!user.rows[0]) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    await issueOtp(normalizedEmail, OTP_PURPOSES.FORGOT_PASSWORD);
    res.json({ success: true, message: 'A verification code has been sent to your email.' });
  } catch (error) { next(error); }
};

exports.verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !isValidOtp(otp)) return res.status(422).json({ success: false, message: 'Please enter a valid 6-digit OTP.' });
    const result = await pool.query(
      'SELECT id, otp_hash, attempts FROM email_otps WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP',
      [normalizedEmail, OTP_PURPOSES.FORGOT_PASSWORD]
    );
    if (!result.rows[0]) throw operationalError('This verification code has expired. Please request a new one.', 400);
    if (result.rows[0].attempts >= MAX_ATTEMPTS) throw operationalError('Too many incorrect attempts. Please request a new code.', 429);
    if (!(await bcrypt.compare(otp, result.rows[0].otp_hash))) {
      await pool.query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [result.rows[0].id]);
      throw operationalError('Incorrect verification code. Please try again.', 400);
    }
    await pool.query('UPDATE email_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1', [result.rows[0].id]);
    res.json({ success: true, message: 'OTP verified successfully.', resetToken: result.rows[0].id.toString() });
  } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { email, resetToken, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!password || password.length < 8 || !/\d/.test(password)) return res.status(422).json({ success: false, message: 'Password must contain at least 8 characters and one number.' });
    await client.query('BEGIN');
    const token = await client.query(
      'UPDATE email_otps SET reset_used_at = CURRENT_TIMESTAMP WHERE id = $1 AND email = $2 AND purpose = $3 AND consumed_at IS NOT NULL AND reset_used_at IS NULL RETURNING id',
      [resetToken, normalizedEmail, OTP_PURPOSES.FORGOT_PASSWORD]
    );
    if (!token.rows[0]) throw operationalError('Password reset session is invalid. Please request a new OTP.', 400);
    await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [await bcrypt.hash(password, 12), normalizedEmail]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
};

exports.login = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const result = await pool.query('SELECT id, name, email, password_hash, role, is_suspended, suspended_until, is_email_verified, wallet_balance FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password. Please try again.' });
    }

    if (user.is_suspended && (!user.suspended_until || new Date(user.suspended_until) > new Date())) {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact the administrator for assistance.' });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your account before signing in.' });
    }

    const accessToken = generateAccessToken(user); const refreshToken = generateRefreshToken(user);
    await pool.query("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '7 days')", [user.id, refreshToken]);
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, wallet: user.wallet_balance } });
  } catch (error) { next(error); }
};
exports.refresh = async (req, res) => { try { const token = req.cookies.refreshToken; const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET); const valid = await pool.query('SELECT 1 FROM refresh_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP', [token]); const user = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]); if (!valid.rows[0] || !user.rows[0]) return res.status(403).json({ success: false, message: 'Invalid refresh token' }); res.json({ success: true, accessToken: generateAccessToken(user.rows[0]) }); } catch { res.status(403).json({ success: false, message: 'Invalid or expired refresh token' }); } };
exports.logout = async (req, res, next) => { try { if (req.cookies.refreshToken) await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [req.cookies.refreshToken]); res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' }); res.json({ success: true, message: 'Logged out successfully' }); } catch (error) { next(error); } };
exports.getMe = async (req, res, next) => { try { const result = await pool.query('SELECT id, name, email, role, wallet_balance, created_at FROM users WHERE id = $1', [req.user.id]); if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' }); res.json({ success: true, user: result.rows[0] }); } catch (error) { next(error); } };
