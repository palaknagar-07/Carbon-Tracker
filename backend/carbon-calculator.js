const { CARBON_FACTORS } = require('./firebase-config');

/**
 * Calculate carbon emissions for a given transport mode and distance
 * @param {string} transportMode - The transport mode (car, motorcycle, bus, train, bicycle, walking)
 * @param {number} distance - Distance in kilometers
 * @returns {object} Object containing carbon calculations
 */
function calculateCarbon(transportMode, distance) {
  // Get carbon factor for the transport mode
  const carbonFactor = CARBON_FACTORS[transportMode.toLowerCase()] || 0;
  
  // Calculate carbon emitted (in grams, then convert to kg)
  const carbonEmitted = (carbonFactor * distance) / 1000; // Convert to kg
  
  // Calculate carbon saved compared to driving a car
  const carCarbonFactor = CARBON_FACTORS.car;
  const carCarbonEmitted = (carCarbonFactor * distance) / 1000; // Convert to kg
  const carbonSavedVsCar = Math.max(0, carCarbonEmitted - carbonEmitted);
  
  // Calculate points earned from carbon saved versus driving
  const pointsEarned = Math.round(carbonSavedVsCar * 50);
  
  return {
    carbonEmitted,
    carbonSavedVsCar,
    pointsEarned,
    carbonFactor,
    distance
  };
}

/**
 * Validate transport mode
 * @param {string} transportMode - The transport mode to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidTransportMode(transportMode) {
  return Object.keys(CARBON_FACTORS).includes(transportMode.toLowerCase());
}

/**
 * Get all available transport modes
 * @returns {array} Array of transport mode objects
 */
function getTransportModes() {
  return Object.keys(CARBON_FACTORS).map(mode => ({
    id: mode,
    name: mode.charAt(0).toUpperCase() + mode.slice(1),
    carbonFactor: CARBON_FACTORS[mode]
  }));
}

module.exports = {
  calculateCarbon,
  isValidTransportMode,
  getTransportModes,
  CARBON_FACTORS
};
