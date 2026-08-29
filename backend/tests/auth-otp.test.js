const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidOtp, generateOtp } = require('../src/utils/otpUtils');
const { buildOtpEmail } = require('../src/utils/emailService');

test('OTP generator returns a six-digit numeric code', () => {
  const otp = generateOtp();
  assert.match(otp, /^\d{6}$/);
  assert.equal(otp.length, 6);
});

test('OTP validator accepts only six digits', () => {
  assert.equal(isValidOtp('123456'), true);
  assert.equal(isValidOtp('12345'), false);
  assert.equal(isValidOtp('abcdef'), false);
});

test('OTP email builder includes branding and expiry details', () => {
  const mail = buildOtpEmail({ purpose: 'SIGNUP_VERIFICATION', otp: '123456', expiresMinutes: 5, supportEmail: 'hello@velosync.com' });
  assert.equal(mail.subject, 'VeloSync Email Verification OTP');
  assert.match(mail.html, /123456/);
  assert.match(mail.html, /5 minutes/);
});
