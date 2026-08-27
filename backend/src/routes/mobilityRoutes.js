const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getBikes, startRide, endRide, updateTelemetry } = require('../controllers/mobilityController');

const router = express.Router();
router.get('/bikes', getBikes);
router.post('/rides/start', protect, startRide);
router.post('/rides/end', protect, endRide);
router.post('/iot/devices/:deviceId/telemetry', protect, updateTelemetry);

module.exports = router;
