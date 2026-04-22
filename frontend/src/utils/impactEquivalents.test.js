import { calculateEnvironmentalImpact, getTripImpactMessaging } from './impactEquivalents';

describe('impactEquivalents', () => {
  test('calculates realistic car off-road hours from CO2 saved', () => {
    const impact = calculateEnvironmentalImpact(0.384);

    expect(impact.carHoursOffRoad).toBeCloseTo(0.167, 2);
    expect(impact.carHoursOffRoad).toBeLessThan(1);
  });

  test('calculates LED bulb hours from CO2 saved using kWh equivalence', () => {
    const impact = calculateEnvironmentalImpact(0.92);

    expect(impact.lightBulbHours).toBeCloseTo(100, 5);
  });

  test('returns eco-friendly messaging for walking', () => {
    const content = getTripImpactMessaging('walking');

    expect(content.title).toBe('Great Choice! 🌍');
    expect(content.message).toMatch(/positive impact on the environment/i);
  });

  test('returns higher-impact messaging for car trips', () => {
    const content = getTripImpactMessaging('car');

    expect(content.title).toBe('Trip Logged');
    expect(content.message).toMatch(/higher carbon impact/i);
  });
});
