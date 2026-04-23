const DEFAULT_DAILY_DISTANCE_LIMIT_KM = 300;

const DAILY_DISTANCE_LIMITS_KM = {
  walking: 80,
  bicycle: 200,
  bus: 600,
  train: 1500,
  motorcycle: 800,
  car: 1200
};

function normalizeTransportMode(transportMode) {
  return String(transportMode || '').trim().toLowerCase();
}

function getDailyDistanceLimitKm(transportMode) {
  const normalizedMode = normalizeTransportMode(transportMode);
  return DAILY_DISTANCE_LIMITS_KM[normalizedMode] || DEFAULT_DAILY_DISTANCE_LIMIT_KM;
}

function formatDistanceKm(distanceKm) {
  return Number(distanceKm).toLocaleString('en-IN', {
    maximumFractionDigits: distanceKm % 1 === 0 ? 0 : 1,
    minimumFractionDigits: 0
  });
}

function buildDailyDistanceLimitMessage({ transportMode, currentDistanceKm, proposedDistanceKm }) {
  const normalizedMode = normalizeTransportMode(transportMode);
  const limitKm = getDailyDistanceLimitKm(normalizedMode);
  const remainingKm = Math.max(0, limitKm - currentDistanceKm);
  const modeLabel = normalizedMode || 'this';

  return `You've reached today's ${modeLabel} distance limit. ${modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1)} trips are capped at ${formatDistanceKm(limitKm)} km per day. You've already logged ${formatDistanceKm(currentDistanceKm)} km today, so you can add up to ${formatDistanceKm(remainingKm)} km more.`;
}

module.exports = {
  DAILY_DISTANCE_LIMITS_KM,
  DEFAULT_DAILY_DISTANCE_LIMIT_KM,
  buildDailyDistanceLimitMessage,
  getDailyDistanceLimitKm,
  normalizeTransportMode
};
