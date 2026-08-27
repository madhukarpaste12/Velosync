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

  const logout = async () => {
    try { await authService.logout(); }
    catch { authService.clearSession(); }
    setUser(null);
  };

  return (
    <SessionContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
};

