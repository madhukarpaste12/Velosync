import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

  if (isLoading && !bypassAuth) return <div className="loading-screen">Checking session...</div>;
  if (!user && !bypassAuth) {
    // Redirect them to the /signin page, but save the current location they were trying to go to
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
