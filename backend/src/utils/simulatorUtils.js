const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeNetworkStatus = (value) => {
  const allowed = ['ONLINE', 'WEAK', 'OFFLINE'];
  const normalized = String(value || 'ONLINE').toUpperCase();
  return allowed.includes(normalized) ? normalized : 'ONLINE';
};

const normalizeLockStatus = (value) => {
  const normalized = String(value || 'UNLOCKED').toUpperCase();
  return normalized === 'LOCKED' ? 'LOCKED' : 'UNLOCKED';
};

const validateTelemetryPayload = (payload = {}) => {
  const tripId = payload.tripId || payload.trip_id;
  const bicycleId = payload.bicycleId || payload.bicycle_id || payload.deviceId;
  const latitude = toNumber(payload.latitude ?? payload.lat, Number.NaN);
  const longitude = toNumber(payload.longitude ?? payload.lng, Number.NaN);
  const batteryLevel = toNumber(payload.batteryLevel ?? payload.battery, Number.NaN);
  const networkStatus = normalizeNetworkStatus(payload.networkStatus ?? payload.network);
  const lockStatus = normalizeLockStatus(payload.lockStatus ?? payload.isLocked);

  if (bicycleId !== undefined && bicycleId !== null && typeof bicycleId !== 'string') {
    throw new Error('Bicycle ID must be a string when provided.');
  }

  if (!tripId || typeof tripId !== 'string') {
    throw new Error('Trip ID is required.');
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude is invalid.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude is invalid.');
  }

  if (!Number.isFinite(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
    throw new Error('Battery level must be between 0 and 100.');
  }

  if (batteryLevel < 0 || batteryLevel > 100) {
    throw new Error('Battery level must be between 0 and 100.');
  }

  const normalized = {
    tripId,
    latitude,
    longitude,
    batteryLevel: Math.round(batteryLevel),
    networkStatus,
    lockStatus
  };

  if (bicycleId !== undefined && bicycleId !== null) {
    normalized.bicycleId = bicycleId;
  }

  return normalized;
};

const haversineMeters = (startLat, startLng, endLat, endLng) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const lat1 = toRadians(startLat);
  const lat2 = toRadians(endLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const selectNearestStation = ({ latitude, longitude, stations = [], excludeStationId = null }) => {
  if (!Array.isArray(stations) || stations.length === 0) {
    return null;
  }

  const valid = stations.filter((station) => {
    const id = station.id || station.stationId;
    return id && id !== excludeStationId;
  });

  if (valid.length === 0) {
    return null;
  }

  const sorted = [...valid].sort((a, b) => {
    const distanceA = haversineMeters(latitude, longitude, Number(a.lat ?? a.latitude), Number(a.lng ?? a.longitude));
    const distanceB = haversineMeters(latitude, longitude, Number(b.lat ?? b.latitude), Number(b.lng ?? b.longitude));
    return distanceA - distanceB;
  });

  return sorted[0];
};

const buildRoute = ({ startLat, startLng, endLat, endLng, steps = 10 }) => {
  const segmentCount = Math.max(1, Number(steps) || 1);
  const points = [{ latitude: startLat, longitude: startLng }];

  for (let step = 1; step <= segmentCount; step += 1) {
    const fraction = step / segmentCount;
    const latitude = startLat + (endLat - startLat) * fraction;
    const longitude = startLng + (endLng - startLng) * fraction;
    points.push({ latitude, longitude });
  }

  return points;
};

const isWithinRadius = (point, destination, radiusMeters = 20) => {
  const distance = haversineMeters(point.latitude, point.longitude, destination.latitude, destination.longitude);
  return distance <= radiusMeters;
};

const moveTowardDestination = ({
  currentLat,
  currentLng,
  destinationLat,
  destinationLng,
  stepRatio = 0.12
}) => {
  const nextLat = currentLat + (destinationLat - currentLat) * clamp(stepRatio, 0, 1);
  const nextLng = currentLng + (destinationLng - currentLng) * clamp(stepRatio, 0, 1);
  return { latitude: nextLat, longitude: nextLng };
};

module.exports = {
  validateTelemetryPayload,
  selectNearestStation,
  buildRoute,
  isWithinRadius,
  moveTowardDestination,
  haversineMeters
};
