const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    { expiresIn: '15m' } // Short-lived
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d', jwtid: randomUUID() } // Long-lived
  );
};

module.exports = { generateAccessToken, generateRefreshToken };