import { clamp, haversineDistanceMeters } from './geoUtils.js';

export const GPS_FILTER_DEFAULTS = {
  maxAccuracyMeters: 25,
  maxJumpMeters: 80,
  staleThresholdMs: 20000,
  maxSpeedKmh: 140,
  smoothingWindowMs: 1500,
};

export const isRecentReading = (reading, previousReading, thresholdMs = GPS_FILTER_DEFAULTS.staleThresholdMs) => {
  if (!reading || Number.isNaN(Number(reading.timestamp))) {
    return false;
  }

  const timestamp = Number(reading.timestamp);
  if (previousReading && Number.isFinite(Number(previousReading.timestamp))) {
    const diff = Math.abs(timestamp - Number(previousReading.timestamp));
    if (diff > thresholdMs) {
      return false;
    }
  }

  return true;
};

export const validateGpsReading = (reading, previousReading = null, config = {}) => {
  const settings = { ...GPS_FILTER_DEFAULTS, ...config };

  if (!reading || !Number.isFinite(Number(reading.latitude)) || !Number.isFinite(Number(reading.longitude))) {
    return { valid: false, reason: 'invalid-coordinates' };
  }

  if (reading.accuracy === undefined || reading.accuracy === null || Number(reading.accuracy) > settings.maxAccuracyMeters) {
    return { valid: false, reason: 'low-accuracy' };
  }

  const timestamp = Number(reading.timestamp ?? Date.now());
  if (!Number.isFinite(timestamp)) {
    return { valid: false, reason: 'invalid-timestamp' };
  }

  if (previousReading) {
    const distanceMeters = haversineDistanceMeters(
      { latitude: previousReading.latitude, longitude: previousReading.longitude },
      { latitude: reading.latitude, longitude: reading.longitude }
    );

    if (distanceMeters > settings.maxJumpMeters) {
      return { valid: false, reason: 'gps-jump' };
    }

    const elapsedMs = Math.max(1, timestamp - Number(previousReading.timestamp || timestamp));
    const speedMps = distanceMeters / (elapsedMs / 1000);
    const speedKmh = speedMps * 3.6;

    if (Number.isFinite(reading.speed) && reading.speed > 0 && speedKmh > settings.maxSpeedKmh && Math.abs(reading.speed - speedKmh) > 25) {
      return { valid: false, reason: 'speed-anomaly' };
    }
  }

  if (!isRecentReading(reading, previousReading, settings.staleThresholdMs)) {
    return { valid: false, reason: 'stale-reading' };
  }

  return { valid: true, reading };
};

export const smoothPosition = (previous, next, config = {}) => {
  if (!previous) {
    return next;
  }

  const settings = { ...GPS_FILTER_DEFAULTS, ...config };
  const accuracy = Number(next.accuracy ?? settings.maxAccuracyMeters);
  const trust = clamp(1 - Math.max(0, accuracy - 5) / 25, 0.2, 0.85);

  const lat = Number(previous.latitude) + (Number(next.latitude) - Number(previous.latitude)) * trust;
  const lng = Number(previous.longitude) + (Number(next.longitude) - Number(previous.longitude)) * trust;

  return {
    ...next,
    latitude: lat,
    longitude: lng,
  };
};

export const interpolatePosition = (from, to, progress) => {
  const ratio = clamp(progress, 0, 1);
  return {
    latitude: Number(from.latitude) + (Number(to.latitude) - Number(from.latitude)) * ratio,
    longitude: Number(from.longitude) + (Number(to.longitude) - Number(from.longitude)) * ratio,
  };
};
