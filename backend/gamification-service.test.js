const test = require('node:test');
const assert = require('node:assert/strict');

const {
  aggregateWeeklyStats,
  awardXP,
  calculateLevel,
  calculateLevelProgress,
  calculateStreak
} = require('./gamification-service');
const { calculateEnvironmentalImpact } = require('./impact-equivalents');

function toIstDayKey(date) {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

  assert.equal(result.weekXp, 100);
});

test('awardXP uses the reduced commute, badge, challenge, and streak caps', () => {
  const xp = awardXP({
    commutePoints: 400,
    badgeUnlockCount: 5,
    challengeBonus: 200,
    streakBonus: 80
  });

  assert.deepEqual(xp, {
    commuteXp: 50,
    badgeBonus: 100,
    challengeBonus: 40,
    streakBonus: 30,
    totalXp: 150
  });
});

test('calculateLevelProgress is proportional to completed levels', () => {
  assert.equal(calculateLevelProgress(3, 6), 50);
  assert.equal(calculateLevelProgress(7, 6), 100);
});

test('calculateLevel exposes level-based progress instead of XP overflow', () => {
  const level = calculateLevel(2600);

  assert.equal(level.level, 3);
  assert.equal(level.totalLevels, 5);
  assert.equal(level.progressPercent, 60);
});

test('calculateStreak can rebuild strictly from commute history', () => {
  const now = new Date('2026-04-23T12:00:00.000Z');
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const streak = calculateStreak(
    {
      days: [
        toIstDayKey(now),
        toIstDayKey(yesterday),
        toIstDayKey(twoDaysAgo)
      ],
      bestStreak: 3
    },
    [now],
    { rebuildFromHistory: true, now }
  );

  assert.equal(streak.currentStreak, 1);
  assert.equal(streak.days.length, 1);
  assert.equal(streak.streakStatus, 'active');
});

test('calculateStreak preserves stored days during incremental updates', () => {
  const now = new Date('2026-04-23T12:00:00.000Z');
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const streak = calculateStreak(
    {
      days: [toIstDayKey(yesterday)],
      bestStreak: 1
    },
    [now],
    { now }
  );

  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.days.length, 2);
  assert.equal(streak.streakStatus, 'active');
});

test('calculateStreak keeps yesterday streak visible but marks it at risk', () => {
  const now = new Date('2026-04-24T12:00:00.000Z');
  const yesterday = new Date('2026-04-23T12:00:00.000Z');
  const twoDaysAgo = new Date('2026-04-22T12:00:00.000Z');

  const streak = calculateStreak(
    {},
    [twoDaysAgo, yesterday],
    { rebuildFromHistory: true, now }
  );

  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.streakStatus, 'at_risk');
  assert.equal(streak.needsTripToday, true);
});

test('calculateStreak resets current streak after a missed day', () => {
  const now = new Date('2026-04-25T12:00:00.000Z');
  const twoDaysAgo = new Date('2026-04-23T12:00:00.000Z');
  const threeDaysAgo = new Date('2026-04-22T12:00:00.000Z');

  const streak = calculateStreak(
    {},
    [threeDaysAgo, twoDaysAgo],
    { rebuildFromHistory: true, now }
  );

  assert.equal(streak.currentStreak, 0);
  assert.equal(streak.streakStatus, 'broken');
  assert.equal(streak.bestStreak, 2);
});
