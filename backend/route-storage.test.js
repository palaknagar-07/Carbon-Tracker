const test = require('node:test');
const assert = require('node:assert/strict');

const { serializeRouteCoordinatesForFirestore } = require('./route-storage');

test('serializeRouteCoordinatesForFirestore converts nested coordinate arrays to objects', () => {
  const route = [
    [12.9716, 77.5946],
    [12.9721, 77.601]
  ];

  assert.deepEqual(serializeRouteCoordinatesForFirestore(route), [
    { lat: 12.9716, lng: 77.5946 },
    { lat: 12.9721, lng: 77.601 }
  ]);
});

test('serializeRouteCoordinatesForFirestore respects max point limits', () => {
  const route = [
    [12.9716, 77.5946],
    [12.9721, 77.601]
  ];

  assert.deepEqual(serializeRouteCoordinatesForFirestore(route, 1), [
    { lat: 12.9716, lng: 77.5946 }
  ]);
});
