const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createTopUp, getWalletStatus } = require('../controllers/walletController');

router.use(protect);
router.get('/status', getWalletStatus);
router.post('/topup', createTopUp);

module.exports = router;
