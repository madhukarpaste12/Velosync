import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function AdminRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="loading-screen">Checking admin session...</div>;
  if (!user) return <Navigate to="/signin" state={{ from: location }} replace />;
  if (user.role !== 'admin') return <Navigate to="/home" replace />;

  return children;
}
