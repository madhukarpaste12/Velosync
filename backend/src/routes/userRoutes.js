const express = require('express');
const router = express.Router();
const { getProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All routes below this use the protect middleware
router.use(protect); 

router.get('/profile', getProfile);

module.exports = router;