const SESSION_KEY = 'velosync_session';
import api from './api';

export const authService = {
  async signup(data) {
    return (await api.post('/auth/signup', data)).data;
  },

  async verifyOtp(data) {
    return (await api.post('/auth/verify-otp', data)).data;
  },

  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
    return data.user;
  },

  logout() {
    void api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser() {
    const user = localStorage.getItem(SESSION_KEY);
    return user ? JSON.parse(user) : null;
  }
};