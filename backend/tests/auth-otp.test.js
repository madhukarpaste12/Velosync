const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidOtp, generateOtp } = require('../src/utils/otpUtils');
const { buildOtpEmail, getSmtpConfig } = require('../src/utils/emailService');

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

test('SMTP config resolves Gmail-compatible env values and legacy fallback values', () => {
  const original = { ...process.env };
  try {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'velosync.007@gmail.com';
    process.env.SMTP_PASSWORD = 'app-password';
    process.env.SMTP_FROM = 'velosync.007@gmail.com';
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_APP_PASSWORD;

    const config = getSmtpConfig();
    assert.equal(config.host, 'smtp.gmail.com');
    assert.equal(config.port, 587);
    assert.equal(config.secure, false);
    assert.equal(config.auth.user, 'velosync.007@gmail.com');
    assert.equal(config.auth.pass, 'app-password');
    assert.equal(config.from, 'velosync.007@gmail.com');
  } finally {
    process.env = original;
  }
});
