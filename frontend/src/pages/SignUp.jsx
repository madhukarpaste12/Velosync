import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import InputField from '../components/InputField';
import { authService } from '../services/authService';

const initialForm = { name: '', email: '', password: '', otp: '' };

export default function SignUp() {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();
  const { loginAfterSignup } = useAuth();

  useEffect(() => { if (!cooldown) return undefined; const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000); return () => window.clearInterval(timer); }, [cooldown]);

  const update = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setStatus('');
  };

  const validate = () => {
    const next = {};
    if (!formData.name.trim()) next.name = 'This field is required.';
    else if (formData.name.trim().length < 2) next.name = 'Please enter at least 2 characters.';
    if (!formData.email) next.email = 'This field is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) next.email = 'Please enter a valid email address.';
    if (!formData.password) next.password = 'This field is required.';
    else if (formData.password.length < 8) next.password = 'Password must contain at least 8 characters.';
    else if (!/\d/.test(formData.password)) next.password = 'Password must contain at least one number.';
    if (otpSent && !/^\d{6}$/.test(formData.otp)) next.otp = 'Enter the 6-digit verification code.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setIsProcessing(true);
    try {
      if (!otpSent) {
        await authService.signup({ name: formData.name.trim(), email: formData.email, password: formData.password });
        setOtpSent(true);
        setCooldown(30);
        setStatus('A verification code has been sent to your email.');
      } else {
        const result = await authService.verifyOtp(formData);
        // Automatically login after OTP verification
        if (result.accessToken && result.user) {
          await loginAfterSignup(result.accessToken, result.user);
          navigate('/home');
        } else {
          setStatus('Account created. Redirecting to home...');
          navigate('/home');
        }
      }
    } catch (error) {
      setStatus(error.response?.data?.message || 'We could not complete that request. Please try again.');
    } finally { setIsProcessing(false); }
  };

  const resend = async () => {
    if (cooldown || isProcessing) return;
    setIsProcessing(true);
    try {
      await authService.signup({ name: formData.name.trim(), email: formData.email, password: formData.password });
      setCooldown(30);
      setStatus('A new verification code has been sent to your email.');
    } catch (error) { setStatus(error.response?.data?.message || 'Unable to generate a new OTP.'); } finally { setIsProcessing(false); }
  };

  return (
    <div className="auth-shell">
      <section className="auth-aside"><span className="eyebrow">VeloSync / membership</span><h1>Move through the city with less friction.</h1><p>One account for cleaner commutes, smart stations, and rides that fit your day.</p><div className="aside-stat"><strong>24/7</strong><span>connected mobility</span></div></section>
      <main className="auth-card auth-form-card">
        <div className="auth-heading"><span className="brand-mark">VS</span><div><p className="eyebrow">Create an account</p><h2>{otpSent ? 'Verify your email' : 'Join VeloSync'}</h2></div></div>
        {status && <div className={status.includes('OTP') ? 'alert-success' : 'alert-error'} role="status">{status}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <InputField label="Full name" name="name" value={formData.name} onChange={update} error={errors.name} placeholder="Your name" required autoComplete="name" />
          <InputField label="Email address" name="email" type="email" value={formData.email} onChange={update} error={errors.email} placeholder="you@example.com" required autoComplete="email" />
          <InputField label="Password" name="password" type="password" value={formData.password} onChange={update} error={errors.password} placeholder="At least 8 characters" required autoComplete="new-password" />
          {otpSent && <InputField label="Verification code" name="otp" value={formData.otp} onChange={update} error={errors.otp} placeholder="6-digit code" required inputMode="numeric" />}
          <button type="submit" className="btn btn-primary bg-eco-green full-width" disabled={isProcessing}>{isProcessing ? 'Working...' : otpSent ? 'Verify and create account' : 'Send verification code'}</button>
        </form>
        {otpSent && <div className="demo-code" role="status"><span>VERIFICATION</span><small>Use the code sent to your email. Expires in 5 minutes.</small><button type="button" className="text-action" onClick={resend} disabled={cooldown > 0 || isProcessing}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}</button></div>}
        <p className="switch-page">Already have an account? <Link to="/signin">Sign in</Link></p>
      </main>
    </div>
  );
}
