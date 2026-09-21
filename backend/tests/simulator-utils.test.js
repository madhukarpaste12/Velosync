const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateTelemetryPayload,
  selectNearestStation,
  buildRoute,
  isWithinRadius
} = require('../src/utils/simulatorUtils');

test('telemetry validation accepts a realistic ESP32 payload', () => {
  const payload = {
    tripId: 'trip-123',
    latitude: 19.0648,
    longitude: 72.8695,
    batteryLevel: 92,
    networkStatus: 'ONLINE',
    lockStatus: 'UNLOCKED'
  };

  assert.deepEqual(validateTelemetryPayload(payload), {
    tripId: 'trip-123',
    latitude: 19.0648,
    longitude: 72.8695,
    batteryLevel: 92,
    networkStatus: 'ONLINE',
    lockStatus: 'UNLOCKED'
  });
});

test('telemetry validation rejects battery values outside 0-100', () => {
  assert.throws(() => validateTelemetryPayload({
    tripId: 'trip-123',
    latitude: 19.0648,
    longitude: 72.8695,
    batteryLevel: 101,
    networkStatus: 'ONLINE',
    lockStatus: 'UNLOCKED'
  }), /battery/i);
});

test('nearest station selection prefers the closest valid station', () => {
  const stations = [
    { id: 'ST-A', lat: 19.0648, lng: 72.8695 },
    { id: 'ST-B', lat: 19.0660, lng: 72.8712 },
    { id: 'ST-C', lat: 19.0700, lng: 72.8750 }
  ];

  const nearest = selectNearestStation({ latitude: 19.0648, longitude: 72.8695, stations, excludeStationId: 'ST-A' });
  assert.equal(nearest.id, 'ST-B');
});

test('route generation returns a stepwise path that approaches the destination', () => {
  const route = buildRoute({
    startLat: 19.0648,
    startLng: 72.8695,
    endLat: 19.0660,
    endLng: 72.8712,
    steps: 4
  });

  assert.equal(route.length, 5);
  assert.ok(route[0].latitude !== route[route.length - 1].latitude || route[0].longitude !== route[route.length - 1].longitude);
  assert.ok(isWithinRadius(route[route.length - 1], { latitude: 19.0660, longitude: 72.8712 }, 1));
});
