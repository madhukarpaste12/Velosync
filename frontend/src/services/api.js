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

// Stations API
export const getStations = async (city) => {
  try {
    const res = await api.get('/mobility/stations', { params: city ? { city } : {} });
    return res.data.stations || [];
  } catch (error) {
    console.error('Failed to fetch stations:', error);
    return [];
  }
};

export const getStation = async (stationId) => {
  try {
    const res = await api.get(`/mobility/stations/${stationId}`);
    return res.data.station || null;
  } catch (error) {
    console.error('Failed to fetch station:', error);
    return null;
  }
};

// User Profile API
export const getUserProfile = async () => {
  try {
    const res = await api.get('/auth/me');
    return res.data.user || null;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
};

// Ride Management API
export const startRide = async (bikeId) => {
  try {
    const res = await api.post('/mobility/rides/start', { bikeId });
    return res.data;
  } catch (error) {
    throw error;
  }
};

// Service Worker / Offline Logic
export const endRideWithOfflineFallback = async (payload) => {
  if (!navigator.onLine || payload.simulatedOffline) {
    // Cache payload locally if in cellular dead-zone
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push(payload);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    return { offline: true, message: 'Network offline. Lock triggered via BLE. Ride data cached locally and will sync when 4G returns.' };
  }
  
  const res = await api.post('/mobility/rides/end', payload);
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
      await api.post('/mobility/rides/end', payload);
    } catch (e) {
      console.error('Failed to sync payload', e);
    }
  }
  localStorage.removeItem('offlineQueue');
};

export default api;