import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import {
  getAdminDashboard, getAdminUsers, getAdminStations, getAdminBicycles,
  getAdminRides, getAdminIssues, getAdminTransactions,
  suspendAdminUser, unsuspendAdminUser, updateAdminIssue
} from '../services/api';

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not available';
const suspensionDate = (days) => new Date(Date.now() + days * 86400000).toISOString();

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState({ stats: {}, users: [], stations: [], bicycles: [], rides: [], issues: [], transactions: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDashboard = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [dashboard, users, stations, bicycles, rides, issues, transactions] = await Promise.all([
        getAdminDashboard(), getAdminUsers(), getAdminStations(), getAdminBicycles(),
        getAdminRides(), getAdminIssues(), getAdminTransactions()
      ]);
      setData({
        stats: dashboard.stats || {}, users: users.users || [], stations: stations.stations || [],
        bicycles: bicycles.bicycles || [], rides: rides.rides || [], issues: issues.issues || [],
        transactions: transactions.transactions || []
      });
    } catch (requestError) {
      setError(requestError?.userFriendly || 'VeloSync is temporarily unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const changeSuspension = async (targetUser, days) => {
    try {
      if (targetUser.is_suspended) await unsuspendAdminUser(targetUser.id);
      else await suspendAdminUser(targetUser.id, suspensionDate(days));
      setNotice(targetUser.is_suspended ? 'User unsuspended.' : `User suspended for ${days} days.`);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError?.userFriendly || 'We could not update the user status. Please try again.');
    }
  };

  const changeIssueStatus = async (issue, status) => {
    try {
      await updateAdminIssue(issue.id, status);
      setNotice('Issue status updated.');
      await loadDashboard();
    } catch (requestError) {
      setError(requestError?.userFriendly || 'We could not update the issue status. Please try again.');
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.replace('/');
  };

  const statItems = [
    ['Total users', data.stats.totalUsers], ['Stations', data.stats.totalStations],
    ['Bicycles', data.stats.totalBicycles], ['Available bicycles', data.stats.availableBicycles],
    ['Bicycles rented', data.stats.rentedBicycles], ['Active rides', data.stats.activeRides],
    ['Active stations', data.stats.activeStations], ['Offline / maintenance', data.stats.offlineMaintenanceStations]
  ];

  if (isLoading && !data.users.length) return <div className="admin-shell"><div className="admin-loading">Loading operations overview...</div></div>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="admin-eyebrow">VeloSync operations</p><h1>Admin dashboard</h1><p className="admin-subtitle">Live visibility across the mobility network.</p></div>
        <div className="admin-header-actions"><span className="admin-user">{user?.name || user?.email}<small>Administrator</small></span><button className="admin-button admin-button-quiet" onClick={handleLogout}>Log out</button></div>
      </header>
      {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}
      <section className="admin-stat-grid" aria-label="System overview">{statItems.map(([label, value]) => <article className="admin-stat" key={label}><span>{label}</span><strong>{value ?? 0}</strong></article>)}</section>

      <section className="admin-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Fleet control</p><h2>Stations</h2></div><span>{data.stations.length} records</span></div><div className="admin-table-wrap"><table><thead><tr><th>Station</th><th>City</th><th>Location</th><th>Capacity</th><th>Available</th><th>Occupied</th><th>Status</th></tr></thead><tbody>{data.stations.map((station) => <tr key={station.id}><td><strong>{station.name}</strong><small>{station.id}</small></td><td>{station.city}</td><td>{station.lat && station.lng ? `${Number(station.lat).toFixed(4)}, ${Number(station.lng).toFixed(4)}` : 'Not available'}</td><td>{station.capacity}</td><td>{station.available_bicycles}</td><td>{station.occupied_bicycles}</td><td><span className={`admin-status ${station.status === 'Active' ? 'is-good' : 'is-warning'}`}>{station.status}</span></td></tr>)}</tbody></table></div></section>

      <section className="admin-two-column"><div className="admin-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Connected fleet</p><h2>Bicycles</h2></div></div><div className="admin-table-wrap"><table><thead><tr><th>ID</th><th>Station</th><th>State</th><th>Device</th><th>Health</th></tr></thead><tbody>{data.bicycles.map((bike) => <tr key={bike.id}><td><strong>{bike.id}</strong></td><td>{bike.station_name || 'In ride'}<small>{bike.city || ''}</small></td><td><span className={`admin-status ${bike.availability === 'Available' ? 'is-good' : 'is-info'}`}>{bike.availability}</span></td><td>{bike.network_status}<small>{bike.battery_level}% battery</small></td><td>{bike.health}</td></tr>)}</tbody></table></div></div><div className="admin-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Live movement</p><h2>Active rides</h2></div></div><div className="admin-list">{data.rides.length ? data.rides.map((ride) => <article className="admin-list-item" key={ride.id}><div><strong>{ride.bicycle_id}</strong><span>{ride.user_name || ride.user_email}</span></div><div><span className="admin-status is-info">{ride.status}</span><small>{formatDate(ride.start_time)}</small></div></article>) : <p className="admin-empty">No active rides.</p>}</div></div></section>

      <section className="admin-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Access control</p><h2>Users</h2></div><span>{data.users.length} records</span></div><div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Wallet</th><th>Registered</th><th>Account</th><th>Action</th></tr></thead><tbody>{data.users.map((targetUser) => <tr key={targetUser.id}><td><strong>{targetUser.name}</strong><small>{targetUser.email}{targetUser.phone_number ? ` · ${targetUser.phone_number}` : ''}</small></td><td>{targetUser.role}</td><td>INR {Number(targetUser.wallet_balance || 0).toFixed(2)}</td><td>{formatDate(targetUser.created_at)}</td><td><span className={`admin-status ${targetUser.is_suspended ? 'is-warning' : 'is-good'}`}>{targetUser.is_suspended ? `Suspended until ${formatDate(targetUser.suspended_until)}` : 'Active'}</span></td><td>{targetUser.role === 'admin' ? <span className="admin-muted">Protected</span> : <button className="admin-button admin-button-small" onClick={() => void changeSuspension(targetUser, 7)}>{targetUser.is_suspended ? 'Unsuspend' : 'Suspend 7 days'}</button>}</td></tr>)}</tbody></table></div></section>

      <section className="admin-two-column"><div className="admin-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Field reports</p><h2>Issues</h2></div></div><div className="admin-list">{data.issues.length ? data.issues.map((issue) => <article className="admin-list-item admin-issue" key={issue.id}><div><strong>{issue.asset_id} · {issue.issue_type}</strong><span>{issue.notes || 'No notes'}<br />{issue.user_name || issue.user_email || 'Unknown reporter'}</span></div><select value={issue.status} onChange={(event) => void changeIssueStatus(issue, event.target.value)}><option value="OPEN">Pending</option><option value="IN_PROGRESS">Investigating</option><option value="RESOLVED">Resolved</option></select></article>) : <p className="admin-empty">No issue reports.</p>}</div></div><div className="admin-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Wallet ledger</p><h2>Transactions</h2></div></div><div className="admin-list">{data.transactions.length ? data.transactions.slice(0, 12).map((transaction) => <article className="admin-list-item" key={transaction.id}><div><strong>INR {Number(transaction.amount).toFixed(2)}</strong><span>{transaction.user_name || transaction.user_email} · {transaction.payment_method}</span></div><div><span className="admin-status is-good">{transaction.status}</span><small>{formatDate(transaction.created_at)}</small></div></article>) : <p className="admin-empty">No transactions.</p>}</div></div></section>
    </main>
  );
}
