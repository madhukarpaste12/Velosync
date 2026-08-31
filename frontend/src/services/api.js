import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  const status = error.response?.status;
  const isAuthRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/signup') || error.config?.url?.includes('/auth/verify-otp');
  if ((status === 401 || status === 403) && !isAuthRequest) window.dispatchEvent(new Event('velosync:auth-invalid'));
  return Promise.reject(error);
});

// Service Worker / Offline Logic
export const endRideWithOfflineFallback = async (payload) => {
  if (!navigator.onLine || payload.simulatedOffline) {
    // Cache payload locally if in cellular dead-zone
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push(payload);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    return { offline: true, message: 'Network offline. Lock triggered via BLE. Ride data cached locally and will sync when 4G returns.' };
  }
  
  const res = await api.post('/rides/end', payload);
  return res.data;
};

export const getWalletGatewayStatus = async () => {
  const res = await api.get('/wallet/status');
  return res.data;
};

export const createWalletTopUp = async (payload) => {
  try {
    const res = await api.post('/wallet/topup', payload);
    return res.data;
  } catch (error) {
    return error.response?.data || { success: false, message: error.message || 'Payment request failed.' };
  }
};

// Background Sync Function called when app detects network
export const syncOfflineRides = async () => {
  const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  if (queue.length === 0) return;
  
  for (const payload of queue) {
    try {
      await api.post('/rides/end', payload);
    } catch (e) {
      console.error('Failed to sync payload', e);
    }
  }
  localStorage.removeItem('offlineQueue');
};

export default api;