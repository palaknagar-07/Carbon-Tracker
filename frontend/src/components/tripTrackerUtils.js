export const MAX_ACCEPTABLE_GPS_ACCURACY_METERS = 50;

export const SPEED_LIMITS = {
  walking: { min: 2, max: 8 },
  bicycle: { min: 8, max: 30 },
  motorcycle: { min: 20, max: 120 },
  car: { min: 15, max: 140 },
  bus: { min: 15, max: 80 },
  train: { min: 30, max: 160 }
};

export function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

export function isAcceptableGpsAccuracy(
  accuracy,
  maxAccuracyMeters = MAX_ACCEPTABLE_GPS_ACCURACY_METERS
) {
  return isFiniteNumber(accuracy) && Number(accuracy) > 0 && Number(accuracy) <= maxAccuracyMeters;
}

export function calculateSegmentSpeedKmH(segmentDistanceKm, timeDiffSeconds) {
  if (!isFiniteNumber(segmentDistanceKm) || !isFiniteNumber(timeDiffSeconds)) return 0;
  const safeDistance = Number(segmentDistanceKm);
  const safeTime = Number(timeDiffSeconds);
  if (safeDistance < 0 || safeTime <= 0) return 0;
  return (safeDistance / safeTime) * 3600;
}

export function validateSpeed(speed, transportMode) {
  const limits = SPEED_LIMITS[transportMode] || SPEED_LIMITS.car;
  const numericSpeed = Number(speed);
  return Number.isFinite(numericSpeed) && numericSpeed >= limits.min && numericSpeed <= limits.max;
}

export function assessGpsPoint({
  point,
  lastAcceptedPoint,
  transportMode,
  calculateDistance
}) {
  if (!isAcceptableGpsAccuracy(point?.accuracy)) {
    return { accepted: false, reason: 'accuracy' };
  }

  if (!lastAcceptedPoint) {
    return {
      accepted: true,
      reason: null,
      segmentDistanceKm: 0,
      speedKmH: 0
    };
  }

  const timeDiffSeconds =
    (Number(point?.timestamp) - Number(lastAcceptedPoint?.timestamp)) / 1000;
  if (!Number.isFinite(timeDiffSeconds) || timeDiffSeconds <= 0) {
    return { accepted: false, reason: 'timing' };
  }

  const segmentDistanceKm = Number(calculateDistance(lastAcceptedPoint, point));
  const speedKmH = calculateSegmentSpeedKmH(segmentDistanceKm, timeDiffSeconds);

  if (!validateSpeed(speedKmH, transportMode)) {
    return {
      accepted: false,
      reason: 'speed',
      segmentDistanceKm,
      speedKmH
    };
  }

  return {
    accepted: true,
    reason: null,
    segmentDistanceKm,
    speedKmH
  };
}
