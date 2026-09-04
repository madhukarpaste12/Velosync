const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, role, is_suspended, suspended_until FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    if (user.is_suspended && (!user.suspended_until || new Date(user.suspended_until) > new Date())) {
      return res.status(403).json({ success: false, message: 'Your account is temporarily suspended.' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed or expired' });
  }
};

module.exports = { protect };