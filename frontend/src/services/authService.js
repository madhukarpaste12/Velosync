const SESSION_KEY = 'velosync_session';
import api from './api';

const clearLocalSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem(SESSION_KEY);
};

export const authService = {
  async signup(data) {
    return (await api.post('/auth/signup', data)).data;
  },

  async verifyOtp(data) {
    const result = await api.post('/auth/verify-otp', data);
    return result.data;
  },

  async requestResetOtp(email) {
    return (await api.post('/auth/forgot-password/request-otp', { email })).data;
  },

  async verifyResetOtp(email, otp) {
    return (await api.post('/auth/forgot-password/verify-otp', { email, otp })).data;
  },

  async resetPassword(data) {
    return (await api.post('/auth/forgot-password/reset', data)).data;
  },

  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
    return data.user;
  },

  async getSession() {
    const { data } = await api.get('/auth/me');
    return data.user;
  },

  async logout() {
    try { await api.post('/auth/logout'); } finally {
      clearLocalSession();
    }
  },

  clearSession() {
    clearLocalSession();
  },

  getCurrentUser() {
    const user = localStorage.getItem(SESSION_KEY);
    return user ? JSON.parse(user) : null;
  }
};