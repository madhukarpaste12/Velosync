const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getStations,
  getStation,
  getBikes,
  getBike,
  getTrip,
  listActiveTrips,
  startRide,
  completeTrip,
  endRide,
  updateTelemetry
} = require('../controllers/mobilityController');

const router = express.Router();
router.get('/stations', getStations);
router.get('/stations/:stationId', getStation);
router.get('/bikes', getBikes);
router.get('/bikes/:bikeId', getBike);
router.get('/trips/active', listActiveTrips);
router.get('/trips/:tripId', getTrip);
router.post('/rides/start', protect, startRide);
router.post('/rides/:tripId/complete', protect, completeTrip);
router.post('/rides/end', protect, endRide);
router.post('/iot/devices/:deviceId/telemetry', protect, updateTelemetry);

module.exports = router;
