import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = (event) => { event.preventDefault(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(email ? 'Please enter a valid email address.' : 'This field is required.'); return; } navigate('/reset-password', { state: { email } }); };
  return <div className="auth-shell single-auth"><main className="auth-card auth-form-card"><div className="auth-heading"><span className="brand-mark">VS</span><div><p className="eyebrow">Account recovery</p><h2>Forgot password?</h2></div></div><p className="form-intro">Enter your email and we will open a secure reset step for this demo.</p><form onSubmit={submit} noValidate><div className="input-group"><label htmlFor="recovery-email">Email address</label><input id="recovery-email" name="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="you@example.com" aria-invalid={Boolean(error)} />{error && <span className="error-message" role="alert">{error}</span>}</div><button className="btn btn-primary bg-ocean-blue full-width" type="submit">Continue</button></form><p className="switch-page"><Link to="/signin">Back to sign in</Link></p></main></div>;
}
