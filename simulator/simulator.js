const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_URL = process.env.SIMULATOR_API_URL || 'http://localhost:5000/api';
const INTERVAL_MS = Number(process.env.SIMULATION_INTERVAL_MS || 3000);
const ARRIVAL_RADIUS_METERS = Number(process.env.ARRIVAL_RADIUS_METERS || 20);
const LOG_PREFIX = process.env.SIMULATOR_LOG_PREFIX || '[ESP32]';

const activeSimulators = new Map();

const logger = (bicycleId, message) => {
  console.log(`${LOG_PREFIX} ${bicycleId} ${message}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = async (url, options = {}) => {
  const response = await axios({ url, ...options, validateStatus: () => true, timeout: 10000 });
  return { status: response.status, data: response.data };
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const pickNearbyStation = async (bicycleId, bicyclePosition) => {
  const response = await requestJson(`${API_URL}/mobility/stations`);
  if (response.status !== 200 || !Array.isArray(response.data?.stations)) {
    throw new Error(`Unable to load station list for ${bicycleId}.`);
  }

  const nearest = response.data.stations
    .map((station) => ({ ...station, distance: haversineMeters(bicyclePosition.latitude, bicyclePosition.longitude, Number(station.lat), Number(station.lng)) }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearest) {
    throw new Error(`No station found for ${bicycleId}.`);
  }

  return {
    id: nearest.id,
    name: nearest.name,
    latitude: Number(nearest.lat),
    longitude: Number(nearest.lng),
    distance: nearest.distance
  };
};

const getTripStatus = async (tripId) => {
  const response = await requestJson(`${API_URL}/mobility/trips/${tripId}`);
  if (response.status === 200 && response.data?.trip) {
    return response.data.trip;
  }
  return null;
};

const sendTelemetry = async ({ bicycleId, tripId, latitude, longitude, batteryLevel, networkStatus, lockStatus }) => {
  const telemetryPayload = {
    tripId,
    latitude,
    longitude,
    batteryLevel,
    networkStatus,
    lockStatus
  };

  const response = await requestJson(`${API_URL}/mobility/iot/devices/${bicycleId}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: telemetryPayload
  });

  return response;
};

const completeTrip = async ({ tripId, bicycleId, latitude, longitude }) => {
  const response = await requestJson(`${API_URL}/mobility/rides/${tripId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { bicycleId, latitude, longitude }
  });

  return response;
};

const processSimulator = async (bicycleId, tripId) => {
  if (activeSimulators.has(bicycleId)) {
    return;
  }

  const instance = { bicycleId, tripId, timer: null, running: true, battery: 92, position: null, destination: null, networkStatus: 'ONLINE', lockStatus: 'UNLOCKED' };
  activeSimulators.set(bicycleId, instance);

  logger(bicycleId, `Active trip detected: ${tripId}`);

  try {
    const trip = await getTripStatus(tripId);
    if (!trip || trip.status !== 'IN_PROGRESS' || trip.bicycle_id !== bicycleId) {
      logger(bicycleId, 'Trip is no longer active. Simulator stopped.');
      activeSimulators.delete(bicycleId);
      return;
    }

    const bicyclePayload = await requestJson(`${API_URL}/mobility/bikes/${bicycleId}`);
    if (bicyclePayload.status !== 200 || !bicyclePayload.data?.bicycle) {
      throw new Error('Bicycle data unavailable.');
    }

    const bike = bicyclePayload.data.bicycle;
    const startLat = Number(bike.lat ?? bike.latitude ?? 19.0648);
    const startLng = Number(bike.lng ?? bike.longitude ?? 72.8695);

    instance.position = { latitude: startLat, longitude: startLng };
    instance.battery = clamp(Number(bike.battery_level || 92), 0, 100);
    instance.lockStatus = 'UNLOCKED';
    instance.networkStatus = 'ONLINE';

    const station = await pickNearbyStation(bicycleId, instance.position);
    instance.destination = station;
    logger(bicycleId, `Destination: ${station.name} (${station.latitude}, ${station.longitude})`);

    const runTick = async () => {
      if (!activeSimulators.has(bicycleId)) {
        return;
      }

      const liveTrip = await getTripStatus(tripId);
      if (!liveTrip || liveTrip.status !== 'IN_PROGRESS' || liveTrip.bicycle_id !== bicycleId) {
        logger(bicycleId, 'Trip inactive. Stopping simulator.');
        activeSimulators.delete(bicycleId);
        return;
      }

      const remainingDistance = haversineMeters(instance.position.latitude, instance.position.longitude, instance.destination.latitude, instance.destination.longitude);
      if (remainingDistance <= ARRIVAL_RADIUS_METERS) {
        const finalPosition = { latitude: instance.destination.latitude, longitude: instance.destination.longitude };
        instance.position = finalPosition;
        instance.lockStatus = 'LOCKED';
        instance.battery = clamp(instance.battery - 1, 0, 100);
        instance.networkStatus = 'ONLINE';

        logger(bicycleId, 'Destination reached');
        logger(bicycleId, `Lock: ${instance.lockStatus}`);

        const finalTelemetry = await sendTelemetry({
          bicycleId,
          tripId,
          latitude: finalPosition.latitude,
          longitude: finalPosition.longitude,
          batteryLevel: instance.battery,
          networkStatus: instance.networkStatus,
          lockStatus: instance.lockStatus
        });

        if (finalTelemetry.status >= 400) {
          logger(bicycleId, `Telemetry delivery failed with status ${finalTelemetry.status}`);
        }

        const completion = await completeTrip({
          tripId,
          bicycleId,
          latitude: finalPosition.latitude,
          longitude: finalPosition.longitude
        });

        if (completion.status >= 200 && completion.status < 300) {
          logger(bicycleId, 'Completing trip');
        } else {
          logger(bicycleId, `Trip completion failed with status ${completion.status}`);
        }

        activeSimulators.delete(bicycleId);
        logger(bicycleId, 'Simulator stopped');
        return;
      }

      const nextStepRatio = 0.12;
      const nextPosition = {
        latitude: instance.position.latitude + (instance.destination.latitude - instance.position.latitude) * nextStepRatio,
        longitude: instance.position.longitude + (instance.destination.longitude - instance.position.longitude) * nextStepRatio
      };

      instance.position = nextPosition;
      instance.battery = clamp(instance.battery - (Math.random() > 0.5 ? 1 : 2), 0, 100);
      instance.networkStatus = Math.random() > 0.88 ? 'WEAK' : 'ONLINE';
      instance.lockStatus = 'UNLOCKED';

      logger(bicycleId, `GPS: ${instance.position.latitude.toFixed(4)}, ${instance.position.longitude.toFixed(4)}`);
      logger(bicycleId, `Battery: ${instance.battery}%`);
      logger(bicycleId, `Network: ${instance.networkStatus}`);
      logger(bicycleId, `Lock: ${instance.lockStatus}`);

      const telemetryResponse = await sendTelemetry({
        bicycleId,
        tripId,
        latitude: instance.position.latitude,
        longitude: instance.position.longitude,
        batteryLevel: instance.battery,
        networkStatus: instance.networkStatus,
        lockStatus: instance.lockStatus
      });

      if (telemetryResponse.status >= 400) {
        logger(bicycleId, `Telemetry failed (${telemetryResponse.status})`);
      } else {
        logger(bicycleId, 'Telemetry sent');
      }

      instance.timer = setTimeout(runTick, INTERVAL_MS);
    };

    instance.timer = setTimeout(runTick, INTERVAL_MS);
  } catch (error) {
    logger(bicycleId, `Error: ${error.message}`);
    activeSimulators.delete(bicycleId);
  }
};

const pollForActiveTrips = async () => {
  try {
    const response = await requestJson(`${API_URL}/mobility/trips/active`);
    if (response.status !== 200 || !Array.isArray(response.data?.trips)) {
      return;
    }

    for (const trip of response.data.trips) {
      const { bicycleId } = trip;
      if (!activeSimulators.has(bicycleId)) {
        await processSimulator(bicycleId, trip.id);
      }
    }
  } catch (error) {
    console.warn('Simulator polling error:', error.message);
  }
};

const start = async () => {
  console.log('VeloSync software ESP32 simulator started');
  while (true) {
    await pollForActiveTrips();
    await sleep(2000);
  }
};

start();
