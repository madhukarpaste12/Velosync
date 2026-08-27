const pool = require('../config/db');

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

const startRide = async (req, res, next) => {
  const { bikeId } = req.body;
  if (!bikeId || typeof bikeId !== 'string') return res.status(422).json({ success: false, message: 'bikeId is required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (!user.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });
    if (Number(user.rows[0].wallet_balance) < 50) throw new Error('Insufficient funds. Minimum wallet balance is INR 50.');
    const bike = await client.query(`SELECT id FROM bicycles WHERE id = $1 AND is_locked = TRUE AND health = 'Good' FOR UPDATE SKIP LOCKED`, [bikeId]);
    if (!bike.rows[0]) throw new Error('Bike not available or already rented.');
    const activeTrip = await client.query("SELECT 1 FROM trips WHERE user_id = $1 AND status = 'IN_PROGRESS'", [req.user.id]);
    if (activeTrip.rows[0]) throw new Error('You already have an active ride.');
    const trip = await client.query('INSERT INTO trips (user_id, bicycle_id) VALUES ($1, $2) RETURNING id, start_time', [req.user.id, bikeId]);
    await client.query('UPDATE bicycles SET is_locked = FALSE, station_id = NULL WHERE id = $1', [bikeId]);
    await client.query('COMMIT');
    req.app.get('io')?.emit('bike:updated', { bikeId, is_locked: false });
    res.status(201).json({ success: true, tripId: trip.rows[0].id, startTime: trip.rows[0].start_time, message: 'Bike unlocked.' });
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
  const { lat, lng, battery, network, isLocked } = req.body;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || !Number.isInteger(Number(battery)) || Number(battery) < 0 || Number(battery) > 100) return res.status(422).json({ success: false, message: 'Valid lat, lng, and battery (0-100) are required.' });
  try {
    const result = await pool.query("UPDATE bicycles SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, battery_level = $3, network_status = $4, is_locked = $5 WHERE id = $6 RETURNING id", [lng, lat, battery, ['ONLINE', 'OFFLINE', 'UNKNOWN'].includes(network) ? network : 'UNKNOWN', Boolean(isLocked), deviceId]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Bicycle not found.' });
    req.app.get('io')?.emit('bike:telemetry', { bikeId: deviceId, lat: Number(lat), lng: Number(lng), battery, network, isLocked: Boolean(isLocked) });
    res.json({ success: true, message: 'Telemetry processed.' });
  } catch (error) { next(error); }
};

module.exports = { getBikes, startRide, endRide, updateTelemetry };
