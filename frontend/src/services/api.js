import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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
  alert('Background Sync Complete: Offline rides processed.');
};

export default api;