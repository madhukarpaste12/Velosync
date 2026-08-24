import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const Start = () => {
  const { user } = useAuth();
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

  // If already logged in, skip the start page
  if (user || bypassAuth) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="page-container center-content bg-light">
      <div className="hero-card">
        <h1 className="brand-title">VeloSync</h1>
        <p className="subtitle">Zero-Carbon Urban Commuting</p>
        <p className="description">
          Join the revolution in micro-mobility. Smart geofenced stations, 
          offline capabilities, and a cleaner city.
        </p>
        <div className="action-buttons">
          <Link to="/signup" className="btn btn-primary bg-eco-green">Get Started</Link>
          <Link to="/signin" className="btn btn-secondary">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Start;
