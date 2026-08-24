import { useState } from 'react';
import { authService } from '../services/authService';
import { SessionContext } from './SessionContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getCurrentUser());

  const login = async (email, password) => {
    const sessionUser = await authService.login(email, password);
    setUser(sessionUser);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <SessionContext.Provider value={{ user, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
};

