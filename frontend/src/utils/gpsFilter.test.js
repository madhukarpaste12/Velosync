import test from 'node:test';
import assert from 'node:assert/strict';

import { haversineDistanceMeters, movePositionByMeters } from './geoUtils.js';
import { validateGpsReading } from './gpsFilter.js';

test('haversine distance calculates a realistic small movement', () => {
  const from = { latitude: 19.076, longitude: 72.8777 };
  const to = { latitude: 19.0761, longitude: 72.8777 };

  const distance = haversineDistanceMeters(from, to);
  assert.ok(distance > 0);
  assert.ok(distance < 30);
});

test('movePositionByMeters shifts by roughly 1 meter east', () => {
  const start = { latitude: 19.076, longitude: 72.8777 };
  const moved = movePositionByMeters(start.latitude, start.longitude, 1, 90);

  assert.ok(Math.abs(moved.latitude - start.latitude) > 0);
  assert.ok(Math.abs(moved.longitude - start.longitude) > 0);
});

test('validateGpsReading rejects large jumps and poor accuracy', () => {
  const previous = { latitude: 19.076, longitude: 72.8777, accuracy: 3, timestamp: Date.now() - 1000 };
  const reading = { latitude: 19.08, longitude: 72.8777, accuracy: 40, timestamp: Date.now() };

  const result = validateGpsReading(reading, previous);
  assert.equal(result.valid, false);
});
