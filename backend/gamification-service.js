const DAY_MS = 24 * 60 * 60 * 1000;
const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const LEVELS = [
  { level: 1, title: 'Seedling', minXp: 0 },
  { level: 2, title: 'Eco Starter', minXp: 300 },
  { level: 3, title: 'Green Warrior', minXp: 900 },
  { level: 4, title: 'Planet Protector', minXp: 1800 },
  { level: 5, title: 'Climate Hero', minXp: 3200 }
];

const STREAK_MILESTONES = { 7: 80, 30: 220, 60: 420, 100: 800 };
const BADGE_UNLOCK_BONUS_XP = 120;

const BADGE_DEFINITIONS = [
  { id: 'streak_3', title: '3 Day Green Start', description: 'Maintain a 3-day commute streak.', icon: '🔥', category: 'streak', condition: { type: 'streakDays', value: 3 } },
  { id: 'streak_7', title: '7 Day Eco Warrior', description: 'Maintain a 7-day commute streak.', icon: '🌿', category: 'streak', condition: { type: 'streakDays', value: 7 } },
  { id: 'streak_30', title: '30 Day Consistency Champion', description: 'Maintain a 30-day commute streak.', icon: '🏅', category: 'streak', condition: { type: 'streakDays', value: 30 } },
  { id: 'streak_100', title: '100 Day Legend', description: 'Maintain a 100-day commute streak.', icon: '👑', category: 'streak', condition: { type: 'streakDays', value: 100 } },
  { id: 'carbon_10', title: 'Saved 10kg CO2', description: 'Save 10kg CO2 versus driving.', icon: '🌱', category: 'carbon', condition: { type: 'carbonSavedTotalKg', value: 10 } },
  { id: 'carbon_50', title: 'Saved 50kg CO2', description: 'Save 50kg CO2 versus driving.', icon: '🌎', category: 'carbon', condition: { type: 'carbonSavedTotalKg', value: 50 } },
  { id: 'carbon_100', title: 'Saved 100kg CO2', description: 'Save 100kg CO2 versus driving.', icon: '🌍', category: 'carbon', condition: { type: 'carbonSavedTotalKg', value: 100 } },
  { id: 'bike_first', title: 'First Bicycle Ride', description: 'Log your first bicycle commute.', icon: '🚴', category: 'commuteType', condition: { type: 'transportCount', transportMode: 'bicycle', value: 1 } },
  { id: 'walk_10', title: '10 Walking Commutes', description: 'Log 10 walking commutes.', icon: '🚶', category: 'commuteType', condition: { type: 'transportCount', transportMode: 'walking', value: 10 } },
  { id: 'bus_25', title: '25 Bus Commutes', description: 'Log 25 bus commutes.', icon: '🚌', category: 'commuteType', condition: { type: 'transportCount', transportMode: 'bus', value: 25 } },
  { id: 'public_transport_hero', title: 'Public Transport Hero', description: 'Log 50 train/bus commutes.', icon: '🚆', category: 'commuteType', condition: { type: 'publicTransportCount', value: 50 } },
  { id: 'rank_top_100', title: 'Top 100 Leaderboard', description: 'Reach top 100 on leaderboard.', icon: '🎯', category: 'ranking', condition: { type: 'leaderboardRankAtMost', value: 100 } },
  { id: 'rank_top_10', title: 'Top 10 Leaderboard', description: 'Reach top 10 on leaderboard.', icon: '🥇', category: 'ranking', condition: { type: 'leaderboardRankAtMost', value: 10 } },
  { id: 'rank_1', title: '#1 Champion', description: 'Reach rank #1 on leaderboard.', icon: '🏆', category: 'ranking', condition: { type: 'leaderboardRankAtMost', value: 1 } }
];

function normalizeToDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts._seconds != null) return new Date(ts._seconds * 1000);
  if (ts.seconds != null) return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDayKey(dateObj) {
  const d = new Date(dateObj);
  if (Number.isNaN(d.getTime())) return null;
  const istTime = new Date(d.getTime() + INDIA_OFFSET_MS);
  const istYear = istTime.getUTCFullYear();
  const istMonth = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const istDay = String(istTime.getUTCDate()).padStart(2, '0');
  return `${istYear}-${istMonth}-${istDay}`;
}

function calculateLevel(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let current = LEVELS[0];
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (xp >= LEVELS[i].minXp) current = LEVELS[i];
  }
  const next = LEVELS.find((l) => l.level === current.level + 1) || null;
  const progress = next
    ? Math.max(0, Math.min(100, Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100)))
    : 100;
  return {
    level: current.level,
    levelTitle: current.title,
    currentXp: xp,
    nextLevelXp: next ? next.minXp : current.minXp,
    progressPercent: progress
  };
}

function calculateStreak(streakDoc, commuteTimestamps) {
  const existing = streakDoc || {};
  const days = new Set((existing.days || []).map((d) => String(d)));
  commuteTimestamps.forEach((ts) => {
    const d = normalizeToDate(ts);
    if (d) days.add(toDayKey(d));
  });
  const sorted = Array.from(days).sort();
  let best = Math.max(0, Number(existing.bestStreak) || 0);
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00.000Z`).getTime();
    const curr = new Date(`${sorted[i]}T00:00:00.000Z`).getTime();
    const diffDays = Math.round((curr - prev) / DAY_MS);
    run = diffDays === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  let current = 0;
  let cursor = new Date();

  while (days.has(toDayKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  const streakCalendar = sorted.slice(-42);
  return {
    currentStreak: current,
    bestStreak: Math.max(best, current),
    days: sorted,
    streakCalendar,
    lastLoggedDate: sorted[sorted.length - 1] || null
  };
}

function checkCondition(def, context) {
  const cond = def.condition || {};
  switch (cond.type) {
    case 'streakDays':
      return Number(context.currentStreak) >= Number(cond.value);
    case 'carbonSavedTotalKg':
      return Number(context.totalCarbonSaved) >= Number(cond.value);
    case 'transportCount':
      // Validate transport mode exists before checking count
      if (!cond.transportMode || !context.transportCounts) return false;
      return Number(context.transportCounts[cond.transportMode] || 0) >= Number(cond.value);
    case 'publicTransportCount':
      return (
        Number(context.transportCounts?.bus || 0) + Number(context.transportCounts?.train || 0)
      ) >= Number(cond.value);
    case 'leaderboardRankAtMost':
      return Number(context.rank || Number.MAX_SAFE_INTEGER) <= Number(cond.value);
    default:
      return false;
  }
}

function checkBadgeUnlocks(context, unlockedIdsSet) {
  const newBadges = BADGE_DEFINITIONS.filter(
    (def) => !unlockedIdsSet.has(def.id) && checkCondition(def, context)
  ).map((def) => ({
    ...def,
    unlockedAt: new Date().toISOString()
  }));
  return newBadges;
}

function awardXP({ commutePoints, challengeBonus = 0, streakBonus = 0, badgeUnlockCount = 0 }) {
  const commuteXp = Math.round(Math.max(0, Number(commutePoints) || 0));
  const badgeBonus = Math.min(badgeUnlockCount * BADGE_UNLOCK_BONUS_XP, 500); // Cap badge bonus at 500 XP
  const challengeBonusCapped = Math.min(Math.max(0, Number(challengeBonus) || 0), 200); // Cap challenge bonus at 200 XP
  const streakBonusCapped = Math.min(Math.max(0, Number(streakBonus) || 0), 100); // Cap streak bonus at 100 XP
  const totalXp = Math.min(commuteXp + challengeBonusCapped + streakBonusCapped + badgeBonus, 1000); // Cap total XP per commute at 1000
  return { 
    commuteXp, 
    streakBonus: streakBonusCapped, 
    challengeBonus: challengeBonusCapped, 
    badgeBonus, 
    totalXp 
  };
}

function generateWeeklySummary({
  weekCommutes = [],
  weekCarbonSaved = 0,
  weekXp = 0,
  percentile = 80,
  unlockedBadges = 0
}) {
  return {
    title: 'Your Weekly Eco Summary',
    highlights: [
      `You logged ${weekCommutes.length} commutes this week.`,
      `You saved ${Number(weekCarbonSaved).toFixed(1)} kg CO2 vs driving.`,
      `You earned ${Math.round(Number(weekXp) || 0)} XP this week.`,
      `You outperformed ${percentile}% of users on carbon savings.`,
      unlockedBadges > 0 ? `You unlocked ${unlockedBadges} new badges.` : 'Keep going for your next badge unlock.'
    ]
  };
}

module.exports = {
  DAY_MS,
  LEVELS,
  STREAK_MILESTONES,
  BADGE_DEFINITIONS,
  BADGE_UNLOCK_BONUS_XP,
  calculateStreak,
  checkBadgeUnlocks,
  awardXP,
  calculateLevel,
  generateWeeklySummary,
  normalizeToDate
};
