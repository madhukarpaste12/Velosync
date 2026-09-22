import { smoothPosition, validateGpsReading } from '../utils/gpsFilter.js';

export const startGpsTracking = ({
  onPosition,
  onError,
  onStatus,
  maxAccuracyMeters = 25,
  maxJumpMeters = 80,
  timeout = 5000,
  maximumAge = 1000,
}) => {
  if (!navigator || !navigator.geolocation) {
    const error = new Error('Geolocation is not supported by this browser.');
    onError?.(error);
    return () => {};
  }

  let previousValidPosition = null;
  let watchId = null;

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const reading = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp,
      };

      const validation = validateGpsReading(reading, previousValidPosition, {
        maxAccuracyMeters,
        maxJumpMeters,
      });

      if (!validation.valid) {
        onStatus?.({ valid: false, reason: validation.reason, reading });
        return;
      }

      const nextPosition = previousValidPosition
        ? smoothPosition(previousValidPosition, validation.reading, { maxAccuracyMeters, maxJumpMeters })
        : validation.reading;

      previousValidPosition = nextPosition;
      onPosition?.(nextPosition);
    },
    (error) => {
      onError?.(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge,
      timeout,
    }
  );

  return () => {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
};
