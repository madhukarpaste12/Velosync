import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const Signup = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', otp: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [testOtp, setTestOtp] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/signup', {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      setOtpSent(true);
      setTestOtp(response.data.testOtp || '');
      setError('');
      alert('OTP Sent! Check your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send OTP. Please try again.');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/verify-otp', formData);
      alert('Account created! Please Sign In.');
      navigate('/signin');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Join VeloSync</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={otpSent ? handleVerify : handleSendOtp}>
          <input type="text" placeholder="Full Name" disabled={otpSent} required onChange={e => setFormData({...formData, name: e.target.value})} />
          <input type="email" placeholder="Email" disabled={otpSent} required onChange={e => setFormData({...formData, email: e.target.value})} />
          <input type="password" placeholder="Password" disabled={otpSent} required onChange={e => setFormData({...formData, password: e.target.value})} />
          
          {otpSent && (
            <input type="text" maxLength="6" placeholder="Enter 6-Digit OTP" required onChange={e => setFormData({...formData, otp: e.target.value})} />
          )}
          
          <button type="submit" className="btn-primary">{otpSent ? 'Verify & Register' : 'Generate OTP'}</button>
        </form>
        <Link to="/signin">Already have an account? Sign In</Link>
      </div>
      {testOtp && (
        <aside className="test-otp" aria-live="polite">
          <span>Testing OTP</span>
          <strong>{testOtp}</strong>
        </aside>
      )}
    </div>
  );
};
export default Signup;
