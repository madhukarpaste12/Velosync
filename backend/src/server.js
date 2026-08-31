const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { verifySmtpConnection } = require('./utils/emailService');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' } });
app.set('io', io);
io.on('connection', () => console.log('Client connected for real-time updates'));

const port = process.env.PORT || 5000;
server.listen(port, async () => {
  console.log(`VeloSync backend listening on port ${port}`);
  const isSmtpConfigured = await verifySmtpConnection();
  if (!isSmtpConfigured) {
    console.warn('[SMTP] OTP emails will fail until SMTP credentials are configured in backend/.env.');
  }
});
