import axios from 'axios';
import { getUserFriendlyError } from '../utils/errorUtils';

const runtimeEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const api = axios.create({ baseURL: runtimeEnv.VITE_API_URL || 'http://localhost:5000/api', withCredentials: true });

export const buildRideEndPayload = ({ tripId, bikeId, lat, lng, simulatedOffline = false }) => {
  if (!tripId || !bikeId || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    throw new Error('tripId, bikeId, lat, and lng are required.');
  }

  return {
    tripId,
    bikeId,
    lat: Number(lat),
    lng: Number(lng),
    simulatedOffline
  };
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  const status = error.response?.status;
  const requestUrl = error.config?.url || '';
  const isPublicAuthRequest = /\/auth\/login|\/auth\/signup|\/auth\/verify-otp|\/auth\/forgot-password|\/auth\/reset-password/.test(requestUrl);
  const errorText = `${error.response?.data?.message || ''} ${error.message || ''}`.toLowerCase();
  const isAccountStatusError = /suspended|temporarily suspended|verify your account|not verified|email.*not.*verified/.test(errorText);

  if ((status === 401 || status === 403) && !isPublicAuthRequest && !isAccountStatusError) {
    window.dispatchEvent(new Event('velosync:auth-invalid'));
  }

  const friendlyMessage = getUserFriendlyError(error);
  if (friendlyMessage && error) {
    error.userFriendly = friendlyMessage;
  }

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

export const getBike = async (bikeId) => {
  try {
    const res = await api.get(`/mobility/bikes/${bikeId}`);
    return res.data.bicycle || null;
  } catch (error) {
    console.error('Failed to fetch bike:', error);
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
  const res = await api.post('/mobility/rides/start', { bikeId });
  return res.data;
};

// Service Worker / Offline Logic
export const endRideWithOfflineFallback = async (payload) => {
  const normalized = buildRideEndPayload(payload);

  if (!navigator.onLine || normalized.simulatedOffline) {
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push(normalized);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    return { offline: true, message: 'Network offline. Lock triggered via BLE. Ride data cached locally and will sync when 4G returns.' };
  }

  const res = await api.post('/mobility/rides/end', normalized);
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

export const getAdminDashboard = async () => (await api.get('/admin/dashboard')).data;
export const getAdminUsers = async () => (await api.get('/admin/users')).data;
export const suspendAdminUser = async (id, suspendedUntil) => (await api.patch(`/admin/users/${id}/suspend`, { suspendedUntil })).data;
export const unsuspendAdminUser = async (id) => (await api.patch(`/admin/users/${id}/unsuspend`)).data;
export const getAdminStations = async () => (await api.get('/admin/stations')).data;
export const getAdminBicycles = async () => (await api.get('/admin/bicycles')).data;
export const getAdminRides = async () => (await api.get('/admin/rides')).data;
export const getAdminIssues = async () => (await api.get('/admin/issues')).data;
export const updateAdminIssue = async (id, status) => (await api.patch(`/admin/issues/${id}`, { status })).data;
export const getAdminTransactions = async () => (await api.get('/admin/transactions')).data;

export default api;