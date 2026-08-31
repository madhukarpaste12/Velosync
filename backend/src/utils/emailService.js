const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return false;
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const secure = normalizeBoolean(process.env.SMTP_SECURE ?? process.env.EMAIL_SECURE ?? (port === 465));
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || '';
  const password = process.env.SMTP_PASSWORD || process.env.EMAIL_APP_PASSWORD || '';
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || user || 'noreply@localhost';

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass: password
    },
    from
  };
};

const createTransporter = () => {
  const config = getSmtpConfig();
  const missing = [];

  if (!config.host) missing.push('SMTP_HOST');
  if (!config.auth.user) missing.push('SMTP_USER');
  if (!config.auth.pass) missing.push('SMTP_PASSWORD');

  if (missing.length) {
    console.warn(`[SMTP] Configuration missing: ${missing.join(', ')}. OTP emails will fail until they are set in backend/.env.`);
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

const transporter = createTransporter();

const getPurposeConfig = (purpose) => {
  if (purpose === 'FORGOT_PASSWORD') {
    return {
      subject: 'VeloSync Password Reset OTP',
      heading: 'Password reset verification',
      message: 'Use the code below to continue resetting your password.'
    };
  }

  return {
    subject: 'VeloSync Email Verification OTP',
    heading: 'Email verification',
    message: 'Use the code below to verify your email address.'
  };
};

const buildOtpEmail = ({ purpose, otp, expiresMinutes = 5, supportEmail = 'hello@velosync.com' }) => {
  const config = getPurposeConfig(purpose);
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2a37;">
      <div style="padding: 24px; border: 1px solid #dfe7ef; border-radius: 12px; background: #f8fbff;">
        <h2 style="margin: 0 0 12px; color: #0f172a;">VeloSync</h2>
        <h3 style="margin: 0 0 12px; color: #0f172a;">${config.heading}</h3>
        <p style="margin: 0 0 16px; font-size: 15px; color: #475569;">${config.message}</p>
        <div style="padding: 18px; border-radius: 10px; background: #ffffff; border: 1px solid #dbe5f0; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 12px; letter-spacing: 0.12em; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Your OTP</div>
          <div style="font-size: 36px; letter-spacing: 0.22em; font-weight: 700; color: #0f172a;">${otp}</div>
        </div>
        <p style="margin: 0 0 12px; font-size: 14px; color: #475569;">This code expires in ${expiresMinutes} minutes.</p>
        <p style="margin: 0; font-size: 14px; color: #475569;">For your security, do not share this code with anyone.</p>
        <p style="margin-top: 18px; font-size: 12px; color: #64748b;">Need help? Contact ${supportEmail}</p>
      </div>
    </div>
  `;

  return {
    subject: config.subject,
    text: `VeloSync OTP: ${otp}. This code expires in ${expiresMinutes} minutes. For your security, do not share this code with anyone.`,
    html: body
  };
};

const verifySmtpConnection = async () => {
  const activeTransporter = transporter || createTransporter();
  if (!activeTransporter) {
    console.warn('[SMTP] SMTP transport is not configured. Skipping connection verification.');
    return false;
  }

  try {
    await activeTransporter.verify();
    console.log(`[SMTP] Connection verified successfully for ${getSmtpConfig().host}:${getSmtpConfig().port}.`);
    return true;
  } catch (error) {
    console.error('[SMTP] Connection verification failed:', error.message);
    return false;
  }
};

const sendOtpEmail = async ({ to, otp, purpose, expiresMinutes = 5 }) => {
  const config = getSmtpConfig();
  const activeTransporter = transporter || createTransporter();

  if (!config.auth.user || !config.auth.pass) {
    throw new Error('Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in backend/.env.');
  }

  if (!activeTransporter) {
    throw new Error('SMTP transporter could not be created. Check your SMTP configuration in backend/.env.');
  }

  const mail = buildOtpEmail({ purpose, otp, expiresMinutes });

  try {
    await activeTransporter.sendMail({
      from: config.from,
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html
    });
    console.log(`[SMTP] OTP email sent successfully for ${to} (${purpose}).`);
    return true;
  } catch (error) {
    console.error('[SMTP] OTP email sending failed:', { to, purpose, error: error.message });
    throw error;
  }
};

module.exports = { sendOtpEmail, buildOtpEmail, getSmtpConfig, verifySmtpConnection };
