export const EARTH_RADIUS_METERS = 6371000;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const haversineDistanceMeters = (from, to) => {
  if (!from || !to) return 0;

  const lat1 = (Number(from.latitude) * Math.PI) / 180;
  const lat2 = (Number(to.latitude) * Math.PI) / 180;
  const deltaLat = ((Number(to.latitude) - Number(from.latitude)) * Math.PI) / 180;
  const deltaLng = ((Number(to.longitude) - Number(from.longitude)) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

export const movePositionByMeters = (latitude, longitude, distanceMeters, bearingDegrees = 0) => {
  const distanceRatio = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = (Number(bearingDegrees) * Math.PI) / 180;
  const lat1 = (Number(latitude) * Math.PI) / 180;
  const lng1 = (Number(longitude) * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceRatio) +
      Math.cos(lat1) * Math.sin(distanceRatio) * Math.cos(bearing)
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distanceRatio) * Math.cos(lat1),
      Math.cos(distanceRatio) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (lng2 * 180) / Math.PI,
  };
};

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const interpolatePosition = (from, to, progress) => {
  if (!from || !to) return from || to;

  const ratio = clamp(progress, 0, 1);
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * ratio,
    longitude: from.longitude + (to.longitude - from.longitude) * ratio,
  };
};
