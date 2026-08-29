const nodemailer = require('nodemailer');

const mailConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
};

const transporter = nodemailer.createTransport(mailConfig);

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

const sendOtpEmail = async ({ to, otp, purpose, expiresMinutes = 5 }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error('Missing Gmail SMTP credentials. Set EMAIL_USER and EMAIL_APP_PASSWORD in backend/.env.');
  }

  const mail = buildOtpEmail({ purpose, otp, expiresMinutes });

  await transporter.sendMail({
    from: `VeloSync <${process.env.EMAIL_USER}>`,
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html
  });

  return true;
};

module.exports = { sendOtpEmail, buildOtpEmail };
