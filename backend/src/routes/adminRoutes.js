const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const {
  getDashboard, getUsers, suspendUser, unsuspendUser, getStations,
  getBicycles, getRides, getIssues, updateIssue, getTransactions
} = require('../controllers/adminController');

const router = express.Router();
router.use(protect, requireAdmin);
router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.patch('/users/:id/suspend', suspendUser);
router.patch('/users/:id/unsuspend', unsuspendUser);
router.get('/stations', getStations);
router.get('/bicycles', getBicycles);
router.get('/rides', getRides);
router.get('/issues', getIssues);
router.patch('/issues/:id', updateIssue);
router.get('/transactions', getTransactions);

module.exports = router;
