import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVeloSyncQrCode, isValidVeloSyncQrCode } from './qrUtils.js';

test('accepts valid VeloSync bicycle QR identifiers', () => {
  assert.equal(parseVeloSyncQrCode('VS-2048'), 'VS-2048');
  assert.equal(parseVeloSyncQrCode(' VS-1842 '), 'VS-1842');
  assert.equal(isValidVeloSyncQrCode('VS-2048'), true);
});

test('rejects invalid VeloSync QR payloads', () => {
  assert.equal(parseVeloSyncQrCode('INVALID'), null);
  assert.equal(parseVeloSyncQrCode('STATION-42'), null);
  assert.equal(isValidVeloSyncQrCode('abc'), false);
});
