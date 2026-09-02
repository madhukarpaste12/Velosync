const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePaymentMethod,
  validateTopupAmount,
  getPaymentGatewayStatus,
  PAYMENT_METHODS
} = require('../src/utils/paymentUtils');

test('top-up amount validation rejects empty and non-positive values', () => {
  assert.equal(validateTopupAmount(''), false);
  assert.equal(validateTopupAmount(0), false);
  assert.equal(validateTopupAmount(-5), false);
  assert.equal(validateTopupAmount(25), true);
  assert.equal(validateTopupAmount('100.50'), true);
});

test('payment method aliases resolve to supported choices', () => {
  assert.equal(normalizePaymentMethod('upi'), 'UPI');
  assert.equal(normalizePaymentMethod('credit card'), 'Credit/Debit Card');
  assert.equal(normalizePaymentMethod('net banking'), 'Net Banking');
  assert.equal(normalizePaymentMethod('demo wallet'), 'Demo Wallet');
  assert.equal(PAYMENT_METHODS.includes('Demo Wallet'), true);
  assert.equal(PAYMENT_METHODS.includes(normalizePaymentMethod('UPI')), true);
});

test('gateway status reflects unconfigured environment by default', () => {
  const status = getPaymentGatewayStatus();
  assert.equal(status.configured, false);
  assert.equal(status.provider, 'none');
});
