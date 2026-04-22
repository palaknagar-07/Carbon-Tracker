const test = require('node:test');
const assert = require('node:assert/strict');

const {
  aggregateWeeklyStats,
  awardXP,
  calculateLevel,
  calculateLevelProgress
} = require('./gamification-service');
const { calculateEnvironmentalImpact } = require('./impact-equivalents');

test('calculateEnvironmentalImpact keeps car off-road hours realistic', () => {
  const impact = calculateEnvironmentalImpact(0.384);

  assert.ok(Math.abs(impact.carHoursOffRoad - (0.384 / 2.3)) < 1e-9);
  assert.ok(impact.carHoursOffRoad < 1);
});

test('calculateEnvironmentalImpact converts CO2 savings to LED bulb hours', () => {
  const impact = calculateEnvironmentalImpact(0.92);

  assert.ok(Math.abs(impact.lightBulbHours - 100) < 1e-9);
});

test('aggregateWeeklyStats sums weekly commute XP and carbon correctly', () => {
  const firstTripXp = awardXP({ commutePoints: 40 }).totalXp;
  const secondTripXp = awardXP({ commutePoints: 25, streakBonus: 80 }).totalXp;

  const result = aggregateWeeklyStats([
    { carbonSavedVsCar: 1.2, xpEarned: firstTripXp },
    { carbonSavedVsCar: 0.6, xpBreakdown: { totalXp: secondTripXp } }
  ], 1000);

  assert.ok(Math.abs(result.weekCarbonSaved - 1.8) < 1e-9);
  assert.equal(result.weekXp, firstTripXp + secondTripXp);
});

test('aggregateWeeklyStats never reports more weekly XP than total XP earned', () => {
  const result = aggregateWeeklyStats([
    { carbonSavedVsCar: 2.4, pointsEarned: 18000 },
    { carbonSavedVsCar: 1.1, pointsEarned: 12000 }
  ], 300);

  assert.equal(result.weekXp, 300);
});

test('calculateLevelProgress is proportional to completed levels', () => {
  assert.equal(calculateLevelProgress(3, 6), 50);
  assert.equal(calculateLevelProgress(7, 6), 100);
});

test('calculateLevel exposes level-based progress instead of XP overflow', () => {
  const level = calculateLevel(950);

  assert.equal(level.level, 3);
  assert.equal(level.totalLevels, 5);
  assert.equal(level.progressPercent, 60);
});
