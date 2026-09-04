const pool = require('../config/db');

const parseSuspensionDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date <= new Date() ? null : date;
};

const getDashboard = async (req, res, next) => {
  try {
    const [users, stations, bicycles, available, rented, rides, offline] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM users'),
      pool.query('SELECT COUNT(*)::int AS count FROM stations'),
      pool.query('SELECT COUNT(*)::int AS count FROM bicycles'),
      pool.query("SELECT COUNT(*)::int AS count FROM bicycles WHERE is_locked = TRUE AND health = 'Good'"),
      pool.query('SELECT COUNT(*)::int AS count FROM bicycles WHERE is_locked = FALSE'),
      pool.query("SELECT COUNT(*)::int AS count FROM trips WHERE status = 'IN_PROGRESS'"),
      pool.query("SELECT COUNT(*)::int AS count FROM bicycles WHERE network_status = 'OFFLINE' OR health <> 'Good'")
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: users.rows[0].count,
        totalStations: stations.rows[0].count,
        totalBicycles: bicycles.rows[0].count,
        availableBicycles: available.rows[0].count,
        rentedBicycles: rented.rows[0].count,
        activeRides: rides.rows[0].count,
        activeStations: stations.rows[0].count,
        offlineMaintenanceStations: offline.rows[0].count
      }
    });
  } catch (error) { next(error); }
};

const getUsers = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone_number, role, is_suspended, suspended_until, wallet_balance, created_at
      FROM users
      ORDER BY created_at DESC NULLS LAST, email
    `);
    res.json({ success: true, users: result.rows });
  } catch (error) { next(error); }
};

const suspendUser = async (req, res, next) => {
  try {
    const suspendedUntil = parseSuspensionDate(req.body?.suspendedUntil);
    if (!suspendedUntil) return res.status(422).json({ success: false, message: 'A future suspendedUntil date is required.' });
    const result = await pool.query(
      `UPDATE users SET is_suspended = TRUE, suspended_until = $1
       WHERE id = $2 AND role <> 'admin'
       RETURNING id, is_suspended, suspended_until`,
      [suspendedUntil, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Normal user not found.' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) { next(error); }
};

const unsuspendUser = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_suspended = FALSE, suspended_until = NULL
       WHERE id = $1 AND role <> 'admin'
       RETURNING id, is_suspended, suspended_until`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Normal user not found.' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) { next(error); }
};

const getStations = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.city, s.capacity,
        ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng,
        COUNT(b.id)::int AS total_bicycles,
        COUNT(b.id) FILTER (WHERE b.is_locked = TRUE AND b.health = 'Good')::int AS available_bicycles,
        COUNT(b.id) FILTER (WHERE b.is_locked = FALSE)::int AS occupied_bicycles,
        CASE WHEN COUNT(b.id) FILTER (WHERE b.network_status = 'OFFLINE' OR b.health <> 'Good') > 0 THEN 'Maintenance' ELSE 'Active' END AS status
      FROM stations s LEFT JOIN bicycles b ON b.station_id = s.id
      GROUP BY s.id ORDER BY s.city, s.name
    `);
    res.json({ success: true, stations: result.rows });
  } catch (error) { next(error); }
};

const getBicycles = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.station_id, s.name AS station_name, s.city,
        ST_Y(b.geom::geometry) AS lat, ST_X(b.geom::geometry) AS lng,
        b.battery_level, b.network_status, b.is_locked, b.health,
        CASE WHEN b.is_locked THEN 'Available' ELSE 'Rented' END AS availability
      FROM bicycles b LEFT JOIN stations s ON s.id = b.station_id ORDER BY b.id
    `);
    res.json({ success: true, bicycles: result.rows });
  } catch (error) { next(error); }
};

const getRides = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.start_time, t.status, u.name AS user_name, u.email AS user_email,
        b.id AS bicycle_id, s.name AS starting_station
      FROM trips t JOIN users u ON u.id = t.user_id JOIN bicycles b ON b.id = t.bicycle_id
      LEFT JOIN stations s ON s.id = b.station_id
      WHERE t.status = 'IN_PROGRESS' ORDER BY t.start_time DESC
    `);
    res.json({ success: true, rides: result.rows });
  } catch (error) { next(error); }
};

const getIssues = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.asset_id, i.issue_type, i.notes, i.status, i.created_at, i.updated_at,
        u.name AS user_name, u.email AS user_email
      FROM issue_reports i LEFT JOIN users u ON u.id = i.user_id
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, issues: result.rows });
  } catch (error) { next(error); }
};

const updateIssue = async (req, res, next) => {
  try {
    const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
    if (!allowedStatuses.includes(req.body?.status)) return res.status(422).json({ success: false, message: 'Invalid issue status.' });
    const result = await pool.query(
      'UPDATE issue_reports SET status = $1 WHERE id = $2 RETURNING id, status, updated_at',
      [req.body.status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Issue not found.' });
    res.json({ success: true, issue: result.rows[0] });
  } catch (error) { next(error); }
};

const getTransactions = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.user_id, u.name AS user_name, u.email AS user_email,
        p.amount, p.currency, p.payment_method, p.status, p.provider_reference, p.created_at
      FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC
    `);
    res.json({ success: true, transactions: result.rows });
  } catch (error) { next(error); }
};

module.exports = { getDashboard, getUsers, suspendUser, unsuspendUser, getStations, getBicycles, getRides, getIssues, updateIssue, getTransactions };
