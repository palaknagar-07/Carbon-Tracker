const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDailyDistanceLimitMessage,
  getDailyDistanceLimitKm
} = require('./trip-limits');

test('getDailyDistanceLimitKm returns the configured cap for each transport mode', () => {
  assert.equal(getDailyDistanceLimitKm('walking'), 80);
  assert.equal(getDailyDistanceLimitKm('bicycle'), 200);
  assert.equal(getDailyDistanceLimitKm('bus'), 600);
  assert.equal(getDailyDistanceLimitKm('train'), 1500);
  assert.equal(getDailyDistanceLimitKm('motorcycle'), 800);
  assert.equal(getDailyDistanceLimitKm('car'), 1200);
});

test('getDailyDistanceLimitKm falls back to the default cap for unknown modes', () => {
  assert.equal(getDailyDistanceLimitKm('scooter'), 300);
});

test('buildDailyDistanceLimitMessage explains the cap and remaining distance clearly', () => {
  const message = buildDailyDistanceLimitMessage({
    transportMode: 'train',
    currentDistanceKm: 980,
    proposedDistanceKm: 600
  });

  assert.match(message, /train distance limit/i);
  assert.match(message, /1,500 km per day/i);
  assert.match(message, /980 km today/i);
  assert.match(message, /520 km more/i);
});
