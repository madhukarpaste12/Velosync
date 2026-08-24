import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin', { replace: true }); // replace: true prevents hitting the back button to return here
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">VeloSync</div>
      <div className="nav-controls">
        <span className="user-greeting">Hello, {user?.name.split(' ')[0]}</span>
        <button onClick={handleLogout} className="btn-danger">Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;
