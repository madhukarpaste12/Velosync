import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserFriendlyError } from './errorUtils.js';

test('maps unknown email errors to a clear user message', () => {
  const error = { response: { status: 404, data: { message: 'No account found with this email address.' } } };
  assert.equal(getUserFriendlyError(error), 'No account found with this email address.');
});

test('maps invalid email format and network issues cleanly', () => {
  assert.equal(getUserFriendlyError({ response: { status: 422, data: { message: 'Please enter a valid email address.' } } }), 'Please enter a valid email address.');
  assert.equal(getUserFriendlyError({ message: 'Network Error' }), 'No internet connection. Please check your network and try again.');
});

test('shows an active-ride message only for a real active trip and not for unavailable bicycles', () => {
  assert.equal(
    getUserFriendlyError({ response: { status: 409, data: { message: 'You already have an active ride. Please complete your current ride before renting another bicycle.' } } }),
    'You already have an active ride. Please complete your current ride before renting another bicycle.'
  );

  assert.equal(
    getUserFriendlyError({ response: { status: 409, data: { message: 'Bike not available or already rented.' } } }),
    'This bicycle is currently unavailable. Please choose another bicycle.'
  );
});

test('shows the duplicate-user signup message instead of the bicycle-unavailable message', () => {
  assert.equal(
    getUserFriendlyError({ response: { status: 409, data: { message: 'This user already exists. Please sign in instead.' } } }),
    'This user already exists. Please sign in instead.'
  );
});
