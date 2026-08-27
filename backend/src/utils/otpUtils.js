const crypto = require('crypto');
const bcrypt = require('bcrypt');

const OTP_TTL_MINUTES = 5;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (otp) => bcrypt.hash(otp, 12);
const isValidOtp = (otp) => /^\d{6}$/.test(otp || '');

const demoOtpResponse = (otp) => process.env.NODE_ENV === 'production'
  ? {}
  : { demoOtp: otp, demoOnly: true };

module.exports = { OTP_TTL_MINUTES, REQUEST_COOLDOWN_MS, MAX_ATTEMPTS, generateOtp, hashOtp, isValidOtp, demoOtpResponse };
