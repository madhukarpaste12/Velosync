const crypto = require('crypto');
const bcrypt = require('bcrypt');

const OTP_TTL_MINUTES = 5;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_PURPOSES = {
  SIGNUP_VERIFICATION: 'SIGNUP_VERIFICATION',
  FORGOT_PASSWORD: 'FORGOT_PASSWORD'
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (otp) => bcrypt.hash(otp, 12);
const isValidOtp = (otp) => /^\d{6}$/.test(otp || '');

module.exports = {
  OTP_TTL_MINUTES,
  REQUEST_COOLDOWN_MS,
  MAX_ATTEMPTS,
  OTP_PURPOSES,
  generateOtp,
  hashOtp,
  isValidOtp
};
