const pool = require('../config/db');

exports.getProfile = async (req, res, next) => {
  try {
    // req.user is populated by the authMiddleware
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1', 
      [req.user.id]
    );
    
    res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (error) {
    next(error);
  }
};