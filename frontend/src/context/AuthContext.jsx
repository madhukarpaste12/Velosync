import { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { SessionContext } from './SessionContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      if (!localStorage.getItem('token')) { setIsLoading(false); return; }
      try { setUser(await authService.getSession()); }
      catch { authService.clearSession(); setUser(null); }
      finally { setIsLoading(false); }
    };
    void restore();
  }, []);

  useEffect(() => {
    const handleInvalidSession = () => { authService.clearSession(); setUser(null); };
    window.addEventListener('velosync:auth-invalid', handleInvalidSession);
    return () => window.removeEventListener('velosync:auth-invalid', handleInvalidSession);
  }, []);

  const login = async (email, password) => {
    const sessionUser = await authService.login(email, password);
    setUser(sessionUser);
  };

  const loginAfterSignup = async (accessToken, userData) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('velosync_session', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try { await authService.logout(); }
    catch { authService.clearSession(); }
    setUser(null);
  };

  return (
    <SessionContext.Provider value={{ user, isLoading, login, loginAfterSignup, logout }}>
      {children}
    </SessionContext.Provider>
  );
};

