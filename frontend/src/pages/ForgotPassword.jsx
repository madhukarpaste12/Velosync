import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { if (!seconds && !cooldown) return undefined; const timer = window.setInterval(() => { setSeconds((current) => Math.max(0, current - 1)); setCooldown((current) => Math.max(0, current - 1)); }, 1000); return () => window.clearInterval(timer); }, [seconds, cooldown]);

  const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const requestOtp = async () => {
    if (!validEmail()) return setError(email ? 'Please enter a valid email address.' : 'This field is required.');
    setLoading(true); setError('');
    try {
      await authService.requestResetOtp(email);
      setOtpRequested(true);
      setSeconds(300);
      setCooldown(30);
      setStatus('If an account exists for this email, a verification code has been sent.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to generate a verification code.');
    } finally { setLoading(false); }
  };

  const verify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setError('Please enter a valid 6-digit OTP.');
    setLoading(true); setError('');
    try {
      const response = await authService.verifyResetOtp(email, otp);
      navigate('/reset-password', { state: { email, resetToken: response.resetToken } });
    } catch (verifyError) {
      setError(verifyError.response?.data?.message || 'Incorrect or expired OTP.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell single-auth">
      <main className="auth-card auth-form-card">
        <div className="auth-heading"><span className="brand-mark">VS</span><div><p className="eyebrow">Account recovery</p><h2>{otpRequested ? 'Verify your code' : 'Forgot password?'}</h2></div></div>
        <p className="form-intro">{otpRequested ? `Code expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.` : 'We will send a secure verification code to your registered email.'}</p>
        {status && <div className="alert-success" role="status">{status}</div>}
        {error && <div className="alert-error" role="alert">{error}</div>}
        {!otpRequested ? (
          <div className="input-group">
            <label htmlFor="recovery-email">Email address</label>
            <input id="recovery-email" name="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="you@example.com" />
          </div>
        ) : (
          <div className="input-group">
            <label htmlFor="recovery-otp">6-digit OTP</label>
            <input id="recovery-otp" inputMode="numeric" maxLength="6" value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '')); setError(''); }} placeholder="000000" />
          </div>
        )}
        {!otpRequested ? (
          <button className="btn btn-primary bg-ocean-blue full-width" type="button" onClick={requestOtp} disabled={loading}>{loading ? 'Sending...' : 'Send verification code'}</button>
        ) : (
          <div className="payment-actions">
            <button className="btn btn-primary bg-ocean-blue full-width" type="button" onClick={verify} disabled={loading || !seconds}>{loading ? 'Verifying...' : 'Verify OTP'}</button>
            <button className="text-action" type="button" onClick={requestOtp} disabled={loading || cooldown > 0}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}</button>
          </div>
        )}
        <p className="switch-page"><Link to="/signin">Back to sign in</Link></p>
      </main>
    </div>
  );
}
