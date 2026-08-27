import { useState } from 'react';
import { useAuth } from '../context/useAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try { await logout(); } finally { window.location.replace('/'); }
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">VeloSync</div>
      <div className="nav-controls">
        <span className="user-greeting">Hello, {user?.name.split(' ')[0]}</span>
        <button onClick={handleLogout} className="btn-danger" disabled={isLoggingOut}>{isLoggingOut ? 'Logging out...' : 'Logout'}</button>
      </div>
    </nav>
  );
};

export default Navbar;
