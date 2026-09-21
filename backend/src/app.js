const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const mobilityRoutes = require('./routes/mobilityRoutes');
const walletRoutes = require('./routes/walletRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Security & Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); // Prevent large payload attacks
app.use(cookieParser()); // Parse cookies

// Rate Limiting
const isPublicApiRoute = (req) => {
  const originalUrl = req.originalUrl || req.url || '';
  const path = req.path || '';

  return (
    originalUrl === '/api/health' ||
    path === '/health' ||
    path.startsWith('/auth/') ||
    path.startsWith('/mobility/stations') ||
    path.startsWith('/mobility/bikes') ||
    path.startsWith('/mobility/trips')
  );
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isPublicApiRoute,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running normally' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/mobility', mobilityRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;