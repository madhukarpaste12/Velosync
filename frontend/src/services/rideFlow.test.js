import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRideEndPayload } from './api.js';

test('buildRideEndPayload keeps the real trip id and coordinates', () => {
  const payload = buildRideEndPayload({ tripId: 'trip-123', bikeId: 'bike-42', lat: 19.076, lng: 72.8777, simulatedOffline: false });

  assert.deepEqual(payload, {
    tripId: 'trip-123',
    bikeId: 'bike-42',
    lat: 19.076,
    lng: 72.8777,
    simulatedOffline: false
  });
});

test('buildRideEndPayload rejects missing ride data', () => {
  assert.throws(() => buildRideEndPayload({ bikeId: 'bike-42', lat: 19.076, lng: 72.8777 }), /tripId, bikeId, lat, and lng are required/);
});
