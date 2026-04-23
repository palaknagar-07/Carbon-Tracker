import {
  MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
  assessGpsPoint,
  calculateSegmentSpeedKmH,
  isAcceptableGpsAccuracy,
  validateSpeed
} from './tripTrackerUtils';

describe('tripTrackerUtils', () => {
  test('accepts GPS accuracy values up to the configured threshold', () => {
    expect(isAcceptableGpsAccuracy(MAX_ACCEPTABLE_GPS_ACCURACY_METERS)).toBe(true);
    expect(isAcceptableGpsAccuracy(MAX_ACCEPTABLE_GPS_ACCURACY_METERS + 0.1)).toBe(false);
  });

  test('calculates segment speed from distance and time', () => {
    expect(calculateSegmentSpeedKmH(0.5, 60)).toBeCloseTo(30, 5);
    expect(calculateSegmentSpeedKmH(0.5, 0)).toBe(0);
  });

  test('validates realistic speed by transport mode', () => {
    expect(validateSpeed(5, 'walking')).toBe(true);
    expect(validateSpeed(18, 'walking')).toBe(false);
    expect(validateSpeed(18, 'bicycle')).toBe(true);
  });

  test('rejects low-quality points before they enter the tracked path', () => {
    const assessment = assessGpsPoint({
      point: {
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 72,
        timestamp: 1000
      },
      lastAcceptedPoint: null,
      transportMode: 'walking',
      calculateDistance: () => 0
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: 'accuracy'
      })
    );
  });

  test('rejects unstable speed spikes while allowing stable points', () => {
    const stable = assessGpsPoint({
      point: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 12,
        timestamp: 61000
      },
      lastAcceptedPoint: {
        latitude: 12.9715,
        longitude: 77.5945,
        accuracy: 10,
        timestamp: 1000
      },
      transportMode: 'walking',
      calculateDistance: () => 0.08
    });

    const noisy = assessGpsPoint({
      point: {
        latitude: 12.9816,
        longitude: 77.6046,
        accuracy: 10,
        timestamp: 7000
      },
      lastAcceptedPoint: {
        latitude: 12.9715,
        longitude: 77.5945,
        accuracy: 10,
        timestamp: 1000
      },
      transportMode: 'walking',
      calculateDistance: () => 0.3
    });

    expect(stable.accepted).toBe(true);
    expect(noisy).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: 'speed'
      })
    );
  });
});
