const pool = require('../config/db');
const { validateTelemetryPayload } = require('../utils/simulatorUtils');

const createOperationalError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode, isOperational: true });

const ensureNoActiveRideForUser = async (client, userId) => {
  const activeTrip = await client.query(
    "SELECT id FROM trips WHERE user_id = $1 AND status = 'IN_PROGRESS' LIMIT 1 FOR UPDATE",
    [userId]
  );

  if (activeTrip.rows[0]) {
    throw createOperationalError('You already have an active ride.', 409);
  }
};

const getStations = async (req, res, next) => {
  try {
    const { city } = req.query;
    let query = `
      SELECT 
        id, name, city, capacity,
        ST_Y(geom::geometry) AS lat, 
        ST_X(geom::geometry) AS lng,
        (SELECT COUNT(*) FROM bicycles WHERE station_id = stations.id AND is_locked = TRUE AND health = 'Good') AS available
      FROM stations
    `;
    const params = [];

    if (city) {
      query += ' WHERE LOWER(city) = LOWER($1)';
      params.push(city);
    }

    query += ' ORDER BY city, name';

    const result = await pool.query(query, params);
    res.json({ success: true, stations: result.rows });
  } catch (error) { next(error); }
};

const getStation = async (req, res, next) => {
  try {
    const { stationId } = req.params;

    const stationResult = await pool.query(`
      SELECT 
        id, name, city, capacity,
        ST_Y(geom::geometry) AS lat, 
        ST_X(geom::geometry) AS lng
      FROM stations
      WHERE id = $1
    `, [stationId]);

    if (!stationResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Station not found.' });
    }

    const station = stationResult.rows[0];

    const bikesResult = await pool.query(`
      SELECT 
        id, battery_level, network_status, is_locked, health,
        ST_Y(geom::geometry) AS lat, 
        ST_X(geom::geometry) AS lng
      FROM bicycles
      WHERE station_id = $1 AND is_locked = TRUE AND health = 'Good'
      ORDER BY id
    `, [stationId]);

    const available = bikesResult.rows.length;

    res.json({
      success: true,
      station: {
        ...station,
        available,
        bicycles: bikesResult.rows
      }
    });
  } catch (error) { next(error); }
};

const getBikes = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, battery_level, network_status, is_locked,
             ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
      FROM bicycles
      WHERE is_locked = TRUE AND health = 'Good'
      ORDER BY id
    `);
    res.json({ success: true, bikes: result.rows });
  } catch (error) { next(error); }
};

const getBike = async (req, res, next) => {
  try {
    const { bikeId } = req.params;
    const result = await pool.query(`
      SELECT id, station_id, battery_level, network_status, is_locked, health,
             ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
      FROM bicycles
      WHERE id = $1
    `, [bikeId]);

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Bicycle not found.' });
    }

    res.json({ success: true, bicycle: result.rows[0] });
  } catch (error) { next(error); }
};

const getTrip = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const result = await pool.query(`
      SELECT id, user_id, bicycle_id, start_time, end_time, fare, status
      FROM trips
      WHERE id = $1
    `, [tripId]);

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Trip not found.' });
    }

    res.json({ success: true, trip: result.rows[0] });
  } catch (error) { next(error); }
};

const listActiveTrips = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, user_id, bicycle_id, start_time, status
      FROM trips
      WHERE status = 'IN_PROGRESS'
      ORDER BY start_time DESC
    `);

    res.json({
      success: true,
      trips: result.rows.map((trip) => ({
        id: trip.id,
        userId: trip.user_id,
        bicycleId: trip.bicycle_id,
        startTime: trip.start_time,
        status: trip.status
      }))
    });
  } catch (error) { next(error); }
};

const startRide = async (req, res, next) => {
  const { bikeId } = req.body;
  if (!bikeId || typeof bikeId !== 'string') return res.status(422).json({ success: false, message: 'bikeId is required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (!user.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });

    const activeTrip = await client.query(
      "SELECT id FROM trips WHERE user_id = $1 AND status = 'IN_PROGRESS' LIMIT 1 FOR UPDATE",
      [req.user.id]
    );
    if (activeTrip.rows[0]) {
      throw createOperationalError('You already have an active ride. Please complete your current ride before renting another bicycle.', 409);
    }

    if (Number(user.rows[0].wallet_balance) < 50) {
      throw createOperationalError('Insufficient wallet balance. Please add money to your wallet before starting the ride.', 402);
    }

    const bike = await client.query(
      `SELECT id FROM bicycles WHERE id = $1 AND is_locked = TRUE AND health = 'Good' FOR UPDATE SKIP LOCKED`,
      [bikeId]
    );
    if (!bike.rows[0]) {
      throw createOperationalError('This bicycle is currently unavailable. Please choose another bicycle.', 409);
    }

    const trip = await client.query('INSERT INTO trips (user_id, bicycle_id) VALUES ($1, $2) RETURNING id, start_time', [req.user.id, bikeId]);
    await client.query('UPDATE bicycles SET is_locked = FALSE, station_id = NULL WHERE id = $1', [bikeId]);
    await client.query('COMMIT');
    req.app.get('io')?.emit('bike:updated', { bikeId, is_locked: false });
    res.status(201).json({ success: true, tripId: trip.rows[0].id, startTime: trip.rows[0].start_time, message: 'Bike unlocked.' });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
};

const completeTrip = async (req, res, next) => {
  const { tripId } = req.params;
  const { bicycleId, latitude, longitude } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const trip = await client.query("SELECT id, user_id, bicycle_id, status FROM trips WHERE id = $1 FOR UPDATE", [tripId]);
    if (!trip.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Trip not found.' });
    }

    if (bicycleId && trip.rows[0].bicycle_id !== bicycleId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Trip does not belong to the requested bicycle.' });
    }

    if (trip.rows[0].status !== 'IN_PROGRESS') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Trip is not active.' });
    }

    const targetLat = Number(latitude ?? 0);
    const targetLng = Number(longitude ?? 0);

    const station = await client.query(
      `SELECT id, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM stations
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       LIMIT 1`,
      [targetLng, targetLat]
    );

    if (!station.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'No station available for trip completion.' });
    }

    const bikeId = trip.rows[0].bicycle_id;
    const fare = 15.0;
    await client.query("UPDATE trips SET end_time = CURRENT_TIMESTAMP, fare = $1, status = 'COMPLETED' WHERE id = $2", [fare, tripId]);
    await client.query(
      'UPDATE bicycles SET is_locked = TRUE, station_id = $1, geom = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography WHERE id = $4',
      [station.rows[0].id, targetLng || station.rows[0].lng, targetLat || station.rows[0].lat, bikeId]
    );
    await client.query(
      "INSERT INTO payments (user_id, trip_id, amount, status, payment_method, provider_reference) VALUES ($1, $2, $3, 'DEMO', 'WALLET', $4)",
      [trip.rows[0].user_id, tripId, fare, `demo-${tripId}`]
    );
    await client.query('COMMIT');

    req.app.get('io')?.emit('bike:updated', { bikeId, is_locked: true, lat: Number(targetLat || station.rows[0].lat), lng: Number(targetLng || station.rows[0].lng) });

    res.json({ success: true, message: 'Trip completed successfully.', tripId, bicycleId: bikeId, stationId: station.rows[0].id });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
};

const endRide = async (req, res, next) => {
  const { tripId, bikeId, lat, lng } = req.body;
  if (!tripId || !bikeId || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return res.status(422).json({ success: false, message: 'tripId, bikeId, lat, and lng are required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const station = await client.query('SELECT id FROM stations WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50) LIMIT 1', [lng, lat]);
    if (!station.rows[0]) throw new Error('Ride must end within 50 metres of a station.');
    const trip = await client.query("SELECT id FROM trips WHERE id = $1 AND bicycle_id = $2 AND user_id = $3 AND status = 'IN_PROGRESS' FOR UPDATE", [tripId, bikeId, req.user.id]);
    if (!trip.rows[0]) throw new Error('Active ride not found.');
    const fare = 15.00;
    await client.query("UPDATE trips SET end_time = CURRENT_TIMESTAMP, fare = $1, status = 'COMPLETED' WHERE id = $2", [fare, tripId]);
    await client.query('UPDATE bicycles SET is_locked = TRUE, station_id = $1, geom = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography WHERE id = $4', [station.rows[0].id, lng, lat, bikeId]);
    await client.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [fare, req.user.id]);
    await client.query("INSERT INTO payments (user_id, trip_id, amount, status, payment_method, provider_reference) VALUES ($1, $2, $3, 'DEMO', 'WALLET', $4)", [req.user.id, tripId, fare, `demo-${tripId}`]);
    await client.query('COMMIT');
    req.app.get('io')?.emit('bike:updated', { bikeId, is_locked: true, lat: Number(lat), lng: Number(lng) });
    res.json({ success: true, message: 'Ride completed successfully.', fare });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
};

const updateTelemetry = async (req, res, next) => {
  const { deviceId } = req.params;
  const normalized = validateTelemetryPayload({
    ...req.body,
    bicycleId: deviceId
  });

  try {
    const trip = await pool.query(
      "SELECT id, status, bicycle_id FROM trips WHERE id = $1 AND bicycle_id = $2 AND status = 'IN_PROGRESS'",
      [normalized.tripId, deviceId]
    );

    if (!trip.rows[0]) {
      return res.status(409).json({ success: false, message: 'Trip is not active for this bicycle.' });
    }

    const result = await pool.query(
      "UPDATE bicycles SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, battery_level = $3, network_status = $4, is_locked = $5 WHERE id = $6 RETURNING id",
      [normalized.longitude, normalized.latitude, normalized.batteryLevel, normalized.networkStatus, normalized.lockStatus === 'LOCKED', deviceId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Bicycle not found.' });
    }

    req.app.get('io')?.emit('bike:telemetry', {
      bikeId: deviceId,
      tripId: normalized.tripId,
      lat: Number(normalized.latitude),
      lng: Number(normalized.longitude),
      battery: normalized.batteryLevel,
      network: normalized.networkStatus,
      isLocked: normalized.lockStatus === 'LOCKED'
    });

    res.json({ success: true, message: 'Telemetry processed.' });
  } catch (error) { next(error); }
};

module.exports = {
  getStations,
  getStation,
  getBikes,
  getBike,
  getTrip,
  listActiveTrips,
  startRide,
  completeTrip,
  endRide,
  updateTelemetry,
  createOperationalError
};
