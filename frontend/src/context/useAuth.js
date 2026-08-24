import { useContext } from 'react';
import { SessionContext } from './SessionContext';

export const useAuth = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
