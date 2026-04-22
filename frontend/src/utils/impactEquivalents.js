export const IMPACT_CONSTANTS_BY_REGION = {
  global: {
    treeKgCo2PerYear: 21,
    avgCarEmissionPerHourKg: 2.3,
    kgCo2PerKwh: 0.92,
    ledBulbKilowatts: 0.01
  }
};

export const DEFAULT_IMPACT_REGION = 'global';

export function getImpactConstants(region = DEFAULT_IMPACT_REGION) {
  return IMPACT_CONSTANTS_BY_REGION[region] || IMPACT_CONSTANTS_BY_REGION[DEFAULT_IMPACT_REGION];
}

export function calculateEnvironmentalImpact(carbonSavedKg, region = DEFAULT_IMPACT_REGION) {
  const carbonSaved = Math.max(0, Number(carbonSavedKg) || 0);
  const constants = getImpactConstants(region);

  return {
    treesEquivalent: carbonSaved / constants.treeKgCo2PerYear,
    carHoursOffRoad: carbonSaved / constants.avgCarEmissionPerHourKg,
    lightBulbHours: (carbonSaved / constants.kgCo2PerKwh) / constants.ledBulbKilowatts,
    constants
  };
}

export function getTripImpactMessaging(transportMode) {
  const mode = String(transportMode || '').toLowerCase();
  const ecoFriendlyModes = new Set(['walking', 'bicycle', 'cycling', 'bus', 'train', 'metro', 'public_transport']);
  const higherImpactModes = new Set(['car', 'taxi', 'motorcycle']);

  if (ecoFriendlyModes.has(mode)) {
    return {
      title: 'Great Choice! 🌍',
      message:
        "Great choice! By choosing this option, you've made a positive impact on the environment. Every eco-friendly trip contributes to a healthier planet. Keep up the great work!"
    };
  }

  if (higherImpactModes.has(mode)) {
    return {
      title: 'Trip Logged',
      message:
        'This trip has a higher carbon impact. Consider choosing more eco-friendly options like walking, cycling, or public transport when possible.'
    };
  }

  return {
    title: 'Trip Logged',
    message:
      'Thanks for logging your trip. For a lower carbon footprint, you might consider alternatives like walking, cycling, or public transport when feasible.'
  };
}
