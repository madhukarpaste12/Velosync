const express = require('express');
const router = express.Router();
const { signup, verifyOtp, login, logout, refresh, getMe } = require('../controllers/authController');
const { validateSignup, validateLogin } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');

router.post('/signup', validateSignup, signup);
router.post('/verify-otp', verifyOtp);
router.post('/login', validateLogin, login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);

module.exports = router;