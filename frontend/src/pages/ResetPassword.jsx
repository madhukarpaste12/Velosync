import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';

export default function ResetPassword() {
  const email = useLocation().state?.email || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const submit = (event) => { event.preventDefault(); if (password.length < 8) return setError('Password must contain at least 8 characters.'); if (password !== confirm) return setError('Passwords do not match.'); navigate('/signin', { state: { message: 'Password reset complete. Sign in with your new password.' } }); };
  return <div className="auth-shell single-auth"><main className="auth-card auth-form-card"><div className="auth-heading"><span className="brand-mark">VS</span><div><p className="eyebrow">Account recovery</p><h2>Set a new password</h2></div></div><p className="form-intro">Resetting access for {email || 'your account'}.</p>{error && <div className="alert-error" role="alert">{error}</div>}<form onSubmit={submit} noValidate><div className="input-group"><label htmlFor="new-password">New password</label><input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div><div className="input-group"><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat your password" /></div><button className="btn btn-primary bg-ocean-blue full-width" type="submit">Reset password</button></form><p className="switch-page"><Link to="/signin">Back to sign in</Link></p></main></div>;
}
