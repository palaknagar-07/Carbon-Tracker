const IMPACT_CONSTANTS_BY_REGION = {
  global: {
    treeKgCo2PerYear: 21,
    avgCarEmissionPerHourKg: 2.3,
    kgCo2PerKwh: 0.92,
    ledBulbKilowatts: 0.01
  }
};

const DEFAULT_IMPACT_REGION = 'global';

function getImpactConstants(region = DEFAULT_IMPACT_REGION) {
  return IMPACT_CONSTANTS_BY_REGION[region] || IMPACT_CONSTANTS_BY_REGION[DEFAULT_IMPACT_REGION];
}

function calculateEnvironmentalImpact(carbonSavedKg, region = DEFAULT_IMPACT_REGION) {
  const carbonSaved = Math.max(0, Number(carbonSavedKg) || 0);
  const constants = getImpactConstants(region);
  const treesEquivalent = carbonSaved / constants.treeKgCo2PerYear;
  const carHoursOffRoad = carbonSaved / constants.avgCarEmissionPerHourKg;
  const lightBulbHours =
    ((carbonSaved / constants.kgCo2PerKwh) / constants.ledBulbKilowatts);

  return {
    treesEquivalent,
    carHoursOffRoad,
    lightBulbHours,
    constants
  };
}

module.exports = {
  DEFAULT_IMPACT_REGION,
  IMPACT_CONSTANTS_BY_REGION,
  getImpactConstants,
  calculateEnvironmentalImpact
};
