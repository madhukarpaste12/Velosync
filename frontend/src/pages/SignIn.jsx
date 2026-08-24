import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import InputField from '../components/InputField';
import { useAuth } from '../context/useAuth';

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [errors, setErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverError, setServerError] = useState('');
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

  // Prevent logged-in users from accessing signin page
  if (user || bypassAuth) return <Navigate to="/home" replace />;

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsProcessing(true);
    try {
      await login(formData.email, formData.password);
      // Redirect to the page they tried to visit, or default to home
      const origin = location.state?.from?.pathname || '/home';
      navigate(origin, { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-container center-content bg-light">
      <div className="auth-card">
        <h2 className="brand-title color-ocean-blue">Welcome Back</h2>
        {serverError && <div className="alert-error">{serverError}</div>}
        
        <form onSubmit={handleSubmit}>
          <InputField label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="Enter your email" />
          <InputField label="Password" name="password" type="password" value={formData.password} onChange={handleChange} error={errors.password} placeholder="Enter your password" />
          
          <div className="checkbox-group">
            <input type="checkbox" id="rememberMe" name="rememberMe" checked={formData.rememberMe} onChange={handleChange} />
            <label htmlFor="rememberMe">Remember Me</label>
          </div>

          <button type="submit" className="btn btn-primary bg-ocean-blue full-width mt-4" disabled={isProcessing}>
            {isProcessing ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        
        <p className="switch-page">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default SignIn;
