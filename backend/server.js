require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const crypto = require('crypto');
const { db, admin } = require('./firebase-config');
const { calculateCarbon, isValidTransportMode } = require('./carbon-calculator');
const {
  DAY_MS,
  STREAK_MILESTONES,
  calculateStreak,
  checkBadgeUnlocks,
  awardXP,
  calculateLevel,
  generateWeeklySummary,
  normalizeToDate
} = require('./gamification-service');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

const MAX_COMMUTE_DISTANCE_KM = Number(process.env.MAX_COMMUTE_DISTANCE_KM) || 5000;
const MAX_NAME_LENGTH = 120;
const MAX_TRACKED_PATH_POINTS = 100;
const MIN_TRIP_INTERVAL_SECONDS = Number(process.env.MIN_TRIP_INTERVAL_SECONDS) || 60;
const MAX_DAILY_DISTANCE_KM = Number(process.env.MAX_DAILY_DISTANCE_KM) || 300;
const MAP_ROUTE_TOKEN_TTL_SECONDS = Number(process.env.MAP_ROUTE_TOKEN_TTL_SECONDS) || 900;
const ROUTE_TOKEN_SECRET = String(process.env.ROUTE_TOKEN_SECRET || process.env.OPENROUTESERVICE_API_KEY || '').trim();
const ROUTE_TOKEN_COLLECTION = 'route_tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORS_ALLOWED_PROFILES = new Set(['driving-car', 'cycling-regular', 'foot-walking']);
const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY || '';

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function safeErrorMessage(error, fallback = 'Internal server error') {
  if (isProd) return fallback;
  return error?.message || fallback;
}

function sendResponse(res, success, payload, message = '', statusCode = 200) {
  const body = { success, message };
  if (success && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    Object.assign(body, payload);
  }
  res.status(statusCode).json(body);
}

function firestoreTimestampToDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts._seconds != null) return new Date(ts._seconds * 1000);
  if (ts.seconds != null) return new Date(ts.seconds * 1000);
  return null;
}

function serializeCommuteDoc(doc) {
  const data = doc.data();
  const rawTs = data.timestamp;
  const d = firestoreTimestampToDate(rawTs);
  return {
    ...data,
    timestamp: d ? d.toISOString() : null
  };
}

function sanitizeUserDocForApi(userData) {
  const { password: _pw, ref: _ref, id: _id, ...rest } = userData;
  const out = { ...rest };
  for (const key of ['joinDate', 'lastUpdate']) {
    if (!out[key]) continue;
    const d = firestoreTimestampToDate(out[key]);
    if (d) out[key] = d.toISOString();
  }
  return out;
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true
  })
);

app.use(express.json({ limit: '64kb' }));

const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.'
  });
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

const commuteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_COMMUTE_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_READ_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

async function getUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const snapshot = await db.collection('users').where('email', '==', normalized).get();
  if (snapshot.empty) return null;
  let first = null;
  snapshot.forEach((doc) => {
    if (!first) first = doc;
  });
  if (!first) return null;
  return { id: first.id, ref: first.ref, ...first.data() };
}

async function getUserByUid(uid) {
  if (!uid) return null;
  const byDocId = await db.collection('users').doc(uid).get();
  if (byDocId.exists) {
    return { id: byDocId.id, ref: byDocId.ref, ...byDocId.data() };
  }

  const snapshot = await db.collection('users').where('uid', '==', uid).get();
  if (snapshot.empty) return null;
  let first = null;
  snapshot.forEach((doc) => {
    if (!first) first = doc;
  });
  if (!first) return null;
  return { id: first.id, ref: first.ref, ...first.data() };
}

async function getUserByUidOrEmail(uid, email) {
  const byUid = await getUserByUid(uid);
  if (byUid) return byUid;
  if (!email) return null;
  return getUserByEmail(email);
}

function pickDisplayName(decodedToken, inputName) {
  const preferred = String(inputName || '').trim();
  if (preferred) return preferred.slice(0, MAX_NAME_LENGTH);

  const tokenName = String(decodedToken.name || '').trim();
  if (tokenName) return tokenName.slice(0, MAX_NAME_LENGTH);

  const emailPrefix = normalizeEmail(decodedToken.email).split('@')[0];
  return emailPrefix ? emailPrefix.slice(0, MAX_NAME_LENGTH) : 'User';
}

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    return sendResponse(res, false, null, 'Missing Authorization token', 401);
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return sendResponse(res, false, null, 'Missing Authorization token', 401);
  }

  admin
    .auth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.authUser = decoded;
      next();
    })
    .catch(() => {
      sendResponse(res, false, null, 'Invalid or expired token', 401);
    });
}

async function upsertUserFromAuth(decodedToken, profileInput = {}) {
  const uid = String(decodedToken.uid || '').trim();
  const email = normalizeEmail(decodedToken.email);

  if (!uid || !email || !EMAIL_RE.test(email)) {
    throw new Error('Authenticated user is missing a valid uid/email');
  }

  const displayName = pickDisplayName(decodedToken, profileInput.name);
  const profilePicture =
    String(profileInput.profilePicture || decodedToken.picture || '').trim() || null;

  const existing = await getUserByUidOrEmail(uid, email);
  const baseUserData = {
    uid,
    email,
    name: displayName,
    profilePicture,
    lastUpdate: admin.firestore.FieldValue.serverTimestamp()
  };

  if (!existing) {
    const userRef = db.collection('users').doc(uid);
    const userData = {
      ...baseUserData,
      totalPoints: 0,
      totalCarbonSaved: 0,
      weeklyCommutes: 0,
      joinDate: admin.firestore.FieldValue.serverTimestamp()
    };
    await userRef.set(userData);
    await updateLeaderboard(uid, userData.name, userData.email, 0, 0, 0);
    return { id: uid, ...userData };
  }

  // Keep canonical user doc at Firebase UID, and migrate legacy docs as needed.
  const canonicalRef = db.collection('users').doc(uid);
  const mergedUser = {
    ...existing,
    ...baseUserData,
    totalPoints: Number(existing.totalPoints) || 0,
    totalCarbonSaved: Number(existing.totalCarbonSaved) || 0,
    weeklyCommutes: Number(existing.weeklyCommutes) || 0
  };

  await canonicalRef.set(
    {
      uid: mergedUser.uid,
      email: mergedUser.email,
      name: mergedUser.name,
      profilePicture: mergedUser.profilePicture,
      totalPoints: mergedUser.totalPoints,
      totalCarbonSaved: mergedUser.totalCarbonSaved,
      weeklyCommutes: mergedUser.weeklyCommutes,
      joinDate: existing.joinDate || admin.firestore.FieldValue.serverTimestamp(),
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  if (existing.id && existing.id !== uid && existing.ref) {
    await existing.ref.delete().catch(() => null);
  }

  await updateLeaderboard(
    uid,
    mergedUser.name,
    mergedUser.email,
    mergedUser.totalPoints,
    mergedUser.totalCarbonSaved,
    mergedUser.weeklyCommutes
  );

  const doc = await canonicalRef.get();
  return { id: doc.id, ...doc.data() };
}

async function updateUserStats(userId, pointsEarned, carbonSaved) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    const newTotalPoints = (userData.totalPoints || 0) + pointsEarned;
    const newTotalCarbonSaved = (userData.totalCarbonSaved || 0) + carbonSaved;
    const newWeeklyCommutes = (userData.weeklyCommutes || 0) + 1;

    await userRef.update({
      totalPoints: newTotalPoints,
      totalCarbonSaved: newTotalCarbonSaved,
      weeklyCommutes: newWeeklyCommutes,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    await updateLeaderboard(
      userId,
      userData.name,
      userData.email,
      newTotalPoints,
      newTotalCarbonSaved,
      newWeeklyCommutes
    );

    return {
      newTotalPoints,
      newTotalCarbonSaved,
      newWeeklyCommutes
    };
  } catch (error) {
    console.error('Error updating user stats:', error);
    return false;
  }
}

async function updateUserTrust(userId, validationMethod, validationScore) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data() || {};
    const validatedTrip =
      (validationMethod === 'gps_tracked' || validationMethod === 'map_route') &&
      Number(validationScore) >= 60;

    const validatedTrips = (Number(userData.validatedTrips) || 0) + (validatedTrip ? 1 : 0);
    const trustScore = Math.min(100, validatedTrips * 5);
    const trustLevel = trustScore >= 70 ? 'high' : trustScore >= 30 ? 'medium' : 'low';

    await userRef.update({
      validatedTrips,
      trustScore,
      trustLevel,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    return { validatedTrips, trustScore, trustLevel };
  } catch (error) {
    console.error('Error updating user trust:', error);
    return null;
  }
}

function hashRouteCoordinates(route) {
  const normalized = route
    .map((p) => [Number(p[0]).toFixed(5), Number(p[1]).toFixed(5)])
    .join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function signRouteToken(payload) {
  if (!ROUTE_TOKEN_SECRET) return null;
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', ROUTE_TOKEN_SECRET)
    .update(payloadEncoded)
    .digest('base64url');
  return `${payloadEncoded}.${sig}`;
}

function verifyRouteToken(token) {
  if (!ROUTE_TOKEN_SECRET || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [payloadEncoded, suppliedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', ROUTE_TOKEN_SECRET)
    .update(payloadEncoded)
    .digest('base64url');
  if (suppliedSig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    return payload;
  } catch (_error) {
    return null;
  }
}

function startOfUtcDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value._seconds != null) return new Date(value._seconds * 1000);
  if (value.seconds != null) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isValidLatLon(lat, lon) {
  return (
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon)) &&
    Number(lat) >= -90 &&
    Number(lat) <= 90 &&
    Number(lon) >= -180 &&
    Number(lon) <= 180
  );
}

async function issueRouteToken(payload) {
  const jti = crypto.randomUUID();
  const tokenPayload = { ...payload, jti };
  const token = signRouteToken(tokenPayload);
  if (!token) return null;
  const expiresAt = admin.firestore.Timestamp.fromMillis(Number(payload.exp) * 1000);
  await db.collection(ROUTE_TOKEN_COLLECTION).doc(jti).set({
    jti,
    used: false,
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return token;
}

async function consumeRouteTokenOrReject(tokenPayload) {
  const jti = String(tokenPayload?.jti || '').trim();
  if (!jti) return { ok: false, error: 'Invalid route token' };

  const tokenRef = db.collection(ROUTE_TOKEN_COLLECTION).doc(jti);
  const now = Date.now();
  try {
    await db.runTransaction(async (tx) => {
      const tokenDoc = await tx.get(tokenRef);
      if (!tokenDoc.exists) throw new Error('invalid');
      const tokenData = tokenDoc.data() || {};
      if (tokenData.used) throw new Error('used');
      const expiresAt = parseToDate(tokenData.expiresAt);
      if (!expiresAt || expiresAt.getTime() < now) throw new Error('expired');
      tx.update(tokenRef, {
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return { ok: true };
  } catch (error) {
    if (error.message === 'used') {
      return { ok: false, error: 'Route token already used. Recalculate route and try again.' };
    }
    if (error.message === 'expired') {
      return { ok: false, error: 'Route token expired. Recalculate route and try again.' };
    }
    return { ok: false, error: 'Invalid route token' };
  }
}

async function enforceTripFrequencyAndDailyDistance(userId, proposedDistanceKm) {
  const commutesRef = db.collection('commutes');
  const now = new Date();
  const minAllowedTs = new Date(now.getTime() - MIN_TRIP_INTERVAL_SECONDS * 1000);
  const dayStart = startOfUtcDay(now);

  const userSnapshot = await commutesRef.where('userId', '==', userId).get();

  let mostRecent = null;
  let todayDistance = 0;
  userSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    const ts = parseToDate(data.timestamp);
    if (ts && (!mostRecent || ts > mostRecent)) {
      mostRecent = ts;
    }
    if (ts && ts >= dayStart) {
      todayDistance += Number(data.distance) || 0;
    }
  });

  if (mostRecent && mostRecent > minAllowedTs) {
    const secondsLeft = Math.max(1, Math.ceil((mostRecent.getTime() - minAllowedTs.getTime()) / 1000));
    return {
      ok: false,
      error: `Trip logging too frequent. Please wait ${secondsLeft} seconds before logging another trip.`
    };
  }

  if (todayDistance + proposedDistanceKm > MAX_DAILY_DISTANCE_KM) {
    return {
      ok: false,
      error: `Daily distance cap exceeded (${MAX_DAILY_DISTANCE_KM} km/day).`
    };
  }

  return { ok: true };
}

async function applyTripEffects(userId, name, email, pointsEarned, carbonSaved, validationMethod, validationScore) {
  const userRef = db.collection('users').doc(userId);
  const leaderboardRef = db.collection('leaderboard').doc(userId);
  const validatedTrip =
    (validationMethod === 'gps_tracked' || validationMethod === 'map_route') &&
    Number(validationScore) >= 60;

  return db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    const userData = userDoc.data() || {};
    const newTotalPoints = (Number(userData.totalPoints) || 0) + pointsEarned;
    const newTotalCarbonSaved = (Number(userData.totalCarbonSaved) || 0) + carbonSaved;
    const newWeeklyCommutes = (Number(userData.weeklyCommutes) || 0) + 1;
    const validatedTrips = (Number(userData.validatedTrips) || 0) + (validatedTrip ? 1 : 0);
    const trustScore = Math.min(100, validatedTrips * 5);
    const trustLevel = trustScore >= 70 ? 'high' : trustScore >= 30 ? 'medium' : 'low';

    tx.update(userRef, {
      totalPoints: newTotalPoints,
      totalCarbonSaved: newTotalCarbonSaved,
      weeklyCommutes: newWeeklyCommutes,
      validatedTrips,
      trustScore,
      trustLevel,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    tx.set(
      leaderboardRef,
      {
        userId,
        name,
        email,
        totalPoints: newTotalPoints,
        totalCarbonSaved: newTotalCarbonSaved,
        weeklyCommutes: newWeeklyCommutes,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return {
      newTotalPoints,
      newTotalCarbonSaved,
      newWeeklyCommutes,
      trust: { validatedTrips, trustScore, trustLevel }
    };
  });
}

async function updateLeaderboard(userId, name, email, totalPoints, totalCarbonSaved, weeklyCommutes) {
  try {
    const leaderboardRef = db.collection('leaderboard').doc(userId);
    await leaderboardRef.set(
      {
        userId,
        name,
        email,
        totalPoints,
        totalCarbonSaved,
        weeklyCommutes,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    return false;
  }
}

async function getLeaderboardRank(userId) {
  const snapshot = await db.collection('leaderboard').orderBy('totalPoints', 'desc').limit(200).get();
  let rank = null;
  let index = 1;
  snapshot.forEach((doc) => {
    if (doc.id === userId || doc.data()?.userId === userId) rank = index;
    index += 1;
  });
  return rank;
}

async function getUserTransportCounts(userId) {
  const snapshot = await db.collection('commutes').where('userId', '==', userId).get();
  const counts = {};
  snapshot.forEach((doc) => {
    const mode = String(doc.data()?.transportMode || 'unknown');
    counts[mode] = (counts[mode] || 0) + 1;
  });
  return counts;
}

async function processGamificationAfterCommute(userId, commutePayload) {
  const userRef = db.collection('users').doc(userId);
  const streakRef = db.collection('streaks').doc(userId);
  const rewardsRef = db.collection('rewards').doc(userId);

  const [userDoc, streakDoc, rewardsDoc, badgesSnap, rank, transportCounts] = await Promise.all([
    userRef.get(),
    streakRef.get(),
    rewardsRef.get(),
    db.collection('badges').where('userId', '==', userId).get(),
    getLeaderboardRank(userId),
    getUserTransportCounts(userId)
  ]);

  if (!userDoc.exists) {
    return null;
  }

  const userData = userDoc.data() || {};
  const streakData = streakDoc.exists ? streakDoc.data() : {};
  const rewardsData = rewardsDoc.exists ? rewardsDoc.data() : {};

  const enrichedStreak = calculateStreak(streakData, [new Date()]);
  const streakBonus = STREAK_MILESTONES[enrichedStreak.currentStreak] || 0;

  const unlockedIds = new Set();
  badgesSnap.forEach((d) => unlockedIds.add(d.data()?.id || d.id));
  const newBadges = checkBadgeUnlocks(
    {
      currentStreak: enrichedStreak.currentStreak,
      totalCarbonSaved: Number(userData.totalCarbonSaved) || 0,
      transportCounts,
      rank
    },
    unlockedIds
  );

  const xpBreakdown = awardXP({
    commutePoints: commutePayload.pointsEarned,
    streakBonus,
    challengeBonus: 0,
    badgeUnlockCount: newBadges.length
  });
  const totalXp = (Number(rewardsData.totalXp) || 0) + xpBreakdown.totalXp;
  const levelData = calculateLevel(totalXp);

  const writes = [];
  writes.push(
    streakRef.set(
      {
        userId,
        ...enrichedStreak,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    )
  );
  writes.push(
    rewardsRef.set(
      {
        userId,
        totalXp,
        level: levelData.level,
        levelTitle: levelData.levelTitle,
        progressPercent: levelData.progressPercent,
        xpBreakdown,
        lastEarnedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    )
  );

  newBadges.forEach((badge) => {
    writes.push(
      db.collection('badges').doc(`${userId}_${badge.id}`).set({
        ...badge,
        userId,
        unlockedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    );
  });

  writes.push(
    db.collection('notifications').doc().set({
      userId,
      type: 'daily_reminder',
      title: "Don't break your streak",
      message: enrichedStreak.currentStreak > 0
        ? `You are on a ${enrichedStreak.currentStreak}-day streak. Keep it alive today.`
        : 'Start your green streak today with one commute log.',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
  );

  if ((Number(streakData.currentStreak) || 0) > 0 && enrichedStreak.currentStreak === 0) {
    writes.push(
      db.collection('notifications').doc().set({
        userId,
        type: 'streak_reset',
        title: 'Streak reset',
        message: 'You missed a day. Start a new streak today.',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
    );
  }

  await Promise.all(writes);

  return {
    streak: enrichedStreak,
    xp: xpBreakdown,
    level: levelData,
    newBadges,
    rank
  };
}

app.get('/api/health', (req, res) => {
  sendResponse(
    res,
    true,
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: isProd ? 'production' : 'development'
    },
    'Health check successful'
  );
});

app.post('/api/auth/session', authLimiter, requireAuth, async (req, res) => {
  try {
    const user = await upsertUserFromAuth(req.authUser, req.body || {});
    const userResponse = sanitizeUserDocForApi(user);
    return sendResponse(res, true, { userId: user.id, user: userResponse }, 'Session established');
  } catch (error) {
    console.error('Session auth error:', error);
    sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  return sendResponse(
    res,
    false,
    null,
    'Deprecated endpoint. Use Firebase client auth + POST /api/auth/session with Bearer token.',
    410
  );
});

// Check if user exists endpoint
app.post('/api/auth/check-user', authLimiter, async (req, res) => {
  return sendResponse(
    res,
    false,
    null,
    'Deprecated endpoint. Use Firebase client auth + POST /api/auth/session with Bearer token.',
    410
  );
});

// Google OAuth login endpoint
app.post('/api/auth/google-login', authLimiter, async (req, res) => {
  return sendResponse(
    res,
    false,
    null,
    'Deprecated endpoint. Use Firebase client auth + POST /api/auth/session with Bearer token.',
    410
  );
});

app.post('/api/commute', commuteLimiter, requireAuth, async (req, res) => {
  try {
    const userId = String(req.authUser.uid || '').trim();
    const { transportMode } = req.body;
    const distance = Number(req.body.distance);

    if (!userId || !transportMode || req.body.distance === undefined || req.body.distance === null) {
      return sendResponse(res, false, null, 'All fields are required', 400);
    }

    if (!isValidTransportMode(transportMode)) {
      return sendResponse(res, false, null, 'Invalid transport mode', 400);
    }

    if (!isFiniteNumber(distance) || distance <= 0) {
      return sendResponse(res, false, null, 'Distance must be a positive number', 400);
    }

    if (distance > MAX_COMMUTE_DISTANCE_KM) {
      return sendResponse(
        res,
        false,
        null,
        `Distance must be at most ${MAX_COMMUTE_DISTANCE_KM} km`,
        400
      );
    }

    const tripGuards = await enforceTripFrequencyAndDailyDistance(userId, distance);
    if (!tripGuards.ok) {
      return sendResponse(res, false, null, tripGuards.error, 429);
    }

    const userData = await getUserByUid(userId);
    if (!userData) {
      return sendResponse(res, false, null, 'User not found', 404);
    }

    const carbonCalculation = calculateCarbon(transportMode, distance);

    const commuteRef = db.collection('commutes').doc();
    await commuteRef.set({
      userId,
      transportMode,
      distance,
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: carbonCalculation.pointsEarned,
      validationMethod: 'manual',
      validationScore: 50, // Lower score for manual entry
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedStats = await applyTripEffects(
      userId,
      userData.name,
      userData.email,
      carbonCalculation.pointsEarned,
      carbonCalculation.carbonSavedVsCar,
      'manual',
      50
    );
    const gamification = await processGamificationAfterCommute(userId, {
      pointsEarned: carbonCalculation.pointsEarned
    });

    sendResponse(res, true, {
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: carbonCalculation.pointsEarned,
      validationMethod: 'manual',
      validationScore: 50,
      bonusMultiplier: 1.0,
      newTotalPoints: updatedStats.newTotalPoints,
      trust: updatedStats.trust,
      gamification
    });
  } catch (error) {
    console.error('Commute logging error:', error);
    sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

// New endpoint for GPS-tracked commutes
app.post('/api/commute/tracked', commuteLimiter, requireAuth, async (req, res) => {
  try {
    const userId = String(req.authUser.uid || '').trim();
    const { transportMode, path, startTime, endTime } = req.body;
    const distance = Number(req.body.distance);
    const duration = Number(req.body.duration);
    const averageSpeed = Number(req.body.averageSpeed);

    if (!userId || !transportMode || !distance || !duration || !path || !startTime || !endTime) {
      return sendResponse(res, false, null, 'All tracking fields are required', 400);
    }

    if (!isValidTransportMode(transportMode)) {
      return sendResponse(res, false, null, 'Invalid transport mode', 400);
    }

    if (!isFiniteNumber(distance) || distance <= 0 || distance > MAX_COMMUTE_DISTANCE_KM) {
      return sendResponse(res, false, null, 'Distance must be a positive number', 400);
    }

    if (!isFiniteNumber(duration) || duration <= 0) {
      return sendResponse(res, false, null, 'Duration must be a positive number', 400);
    }
    if (!isFiniteNumber(averageSpeed) || averageSpeed <= 0) {
      return sendResponse(res, false, null, 'Average speed must be a positive number', 400);
    }

    if (!Array.isArray(path) || path.length < 2) {
      return sendResponse(res, false, null, 'Valid GPS path is required', 400);
    }

    const startMs = Number(startTime);
    const endMs = Number(endTime);
    const nowMs = Date.now();
    if (!isFiniteNumber(startMs) || !isFiniteNumber(endMs) || endMs <= startMs) {
      return sendResponse(res, false, null, 'Invalid trip timestamps', 400);
    }
    if (endMs > nowMs + 5 * 60 * 1000 || startMs < nowMs - 24 * 60 * 60 * 1000) {
      return sendResponse(res, false, null, 'Trip timestamps are outside allowed range', 400);
    }
    if (duration > 12 * 60 * 60) {
      return sendResponse(res, false, null, 'Trip duration exceeds maximum allowed limit', 400);
    }

    const tripGuards = await enforceTripFrequencyAndDailyDistance(userId, Number(distance));
    if (!tripGuards.ok) {
      return sendResponse(res, false, null, tripGuards.error, 429);
    }

    const userData = await getUserByUid(userId);
    if (!userData) {
      return sendResponse(res, false, null, 'User not found', 404);
    }

    // Validate GPS data
    const validationResults = validateTripData(path, transportMode, distance, duration, averageSpeed);
    
    if (!validationResults.isValid) {
      return sendResponse(res, false, null, validationResults.error, 400);
    }

    const computedValidationScore = calculateGpsValidationScore(path, transportMode);
    const carbonCalculation = calculateCarbon(transportMode, distance);

    // Bonus points for validated trips
    const bonusMultiplier =
      computedValidationScore >= 80 ? 1.5 : computedValidationScore >= 60 ? 1.2 : 1.0;
    const adjustedPoints = Math.round(carbonCalculation.pointsEarned * bonusMultiplier);

    const commuteRef = db.collection('commutes').doc();
    await commuteRef.set({
      userId,
      transportMode,
      distance,
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: adjustedPoints,
      validationMethod: 'gps_tracked',
      validationScore: computedValidationScore,
      duration,
      averageSpeed,
      path: path.slice(0, MAX_TRACKED_PATH_POINTS), // Limit stored points to save storage
      startTime: admin.firestore.Timestamp.fromMillis(startMs),
      endTime: admin.firestore.Timestamp.fromMillis(endMs),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedStats = await applyTripEffects(
      userId,
      userData.name,
      userData.email,
      adjustedPoints,
      carbonCalculation.carbonSavedVsCar,
      'gps_tracked',
      computedValidationScore
    );
    const gamification = await processGamificationAfterCommute(userId, {
      pointsEarned: adjustedPoints
    });

    sendResponse(res, true, {
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: adjustedPoints,
      basePoints: carbonCalculation.pointsEarned,
      validationScore: computedValidationScore,
      validationMethod: 'gps_tracked',
      bonusMultiplier,
      newTotalPoints: updatedStats.newTotalPoints,
      trust: updatedStats.trust,
      gamification
    });
  } catch (error) {
    console.error('Tracked commute error:', error);
    sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

app.post('/api/commute/routed', commuteLimiter, requireAuth, async (req, res) => {
  try {
    const userId = String(req.authUser.uid || '').trim();
    const { transportMode, distance, route, startPoint, endPoint, routeToken } = req.body;
    const reportedDistance = Number(distance);

    if (!userId || !transportMode || !isFiniteNumber(reportedDistance) || !route || !startPoint || !endPoint) {
      return sendResponse(res, false, null, 'All map route fields are required', 400);
    }
    if (!Array.isArray(startPoint) || !Array.isArray(endPoint) || startPoint.length !== 2 || endPoint.length !== 2) {
      return sendResponse(res, false, null, 'Invalid start or end coordinates', 400);
    }
    if (!isValidLatLon(startPoint[0], startPoint[1]) || !isValidLatLon(endPoint[0], endPoint[1])) {
      return sendResponse(res, false, null, 'Start or end coordinates are out of bounds', 400);
    }

    if (!isValidTransportMode(transportMode)) {
      return sendResponse(res, false, null, 'Invalid transport mode', 400);
    }

    if (reportedDistance <= 0 || reportedDistance > MAX_COMMUTE_DISTANCE_KM) {
      return sendResponse(
        res,
        false,
        null,
        `Distance must be between 0 and ${MAX_COMMUTE_DISTANCE_KM} km`,
        400
      );
    }

    const tokenPayload = verifyRouteToken(routeToken);
    if (!tokenPayload) {
      return sendResponse(res, false, null, 'Invalid route token', 400);
    }
    if (Number(tokenPayload.exp || 0) < Math.floor(Date.now() / 1000)) {
      return sendResponse(res, false, null, 'Route token expired. Recalculate route and try again.', 400);
    }
    const routeValidation = validateMapRouteData(route, reportedDistance);
    if (!routeValidation.isValid) {
      return sendResponse(res, false, null, routeValidation.error, 400);
    }
    const submittedRouteHash = hashRouteCoordinates(route);
    if (
      tokenPayload.routeHash !== submittedRouteHash ||
      Number(tokenPayload.distanceKm) !== Number(reportedDistance.toFixed(3))
    ) {
      return sendResponse(res, false, null, 'Submitted route does not match validated route token', 400);
    }
    const consumeResult = await consumeRouteTokenOrReject(tokenPayload);
    if (!consumeResult.ok) {
      return sendResponse(res, false, null, consumeResult.error, 400);
    }

    const tripGuards = await enforceTripFrequencyAndDailyDistance(userId, reportedDistance);
    if (!tripGuards.ok) {
      return sendResponse(res, false, null, tripGuards.error, 429);
    }

    const userData = await getUserByUid(userId);
    if (!userData) {
      return sendResponse(res, false, null, 'User not found', 404);
    }

    const validationScore = calculateMapValidationScore(
      routeValidation.routeDistance,
      reportedDistance
    );
    const bonusMultiplier = validationScore >= 60 ? 1.2 : 1.0;
    const carbonCalculation = calculateCarbon(transportMode, reportedDistance);
    const adjustedPoints = Math.round(carbonCalculation.pointsEarned * bonusMultiplier);

    const commuteRef = db.collection('commutes').doc();
    await commuteRef.set({
      userId,
      transportMode,
      distance: reportedDistance,
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: adjustedPoints,
      validationMethod: 'map_route',
      validationScore,
      route: route.slice(0, MAX_TRACKED_PATH_POINTS),
      startPoint: [Number(startPoint[0]), Number(startPoint[1])],
      endPoint: [Number(endPoint[0]), Number(endPoint[1])],
      routeDistanceKm: Number(routeValidation.routeDistance.toFixed(3)),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedStats = await applyTripEffects(
      userId,
      userData.name,
      userData.email,
      adjustedPoints,
      carbonCalculation.carbonSavedVsCar,
      'map_route',
      validationScore
    );
    const gamification = await processGamificationAfterCommute(userId, {
      pointsEarned: adjustedPoints
    });

    return sendResponse(res, true, {
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: adjustedPoints,
      basePoints: carbonCalculation.pointsEarned,
      validationMethod: 'map_route',
      validationScore,
      bonusMultiplier,
      newTotalPoints: updatedStats.newTotalPoints,
      trust: updatedStats.trust,
      gamification
    });
  } catch (error) {
    console.error('Mapped commute error:', error);
    return sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

function validateTripData(path, transportMode, distance, duration, averageSpeed) {
  // Speed limits for different transport modes (km/h)
  const SPEED_LIMITS = {
    walking: { min: 2, max: 8 },
    bicycle: { min: 8, max: 30 },
    motorcycle: { min: 20, max: 120 },
    car: { min: 15, max: 140 },
    bus: { min: 15, max: 80 },
    train: { min: 30, max: 160 }
  };

  const limits = SPEED_LIMITS[transportMode] || SPEED_LIMITS.car;

  if (!isFiniteNumber(distance) || !isFiniteNumber(duration) || !isFiniteNumber(averageSpeed)) {
    return { isValid: false, error: 'Trip metrics must be valid numbers' };
  }

  // Validate average speed
  if (averageSpeed < limits.min || averageSpeed > limits.max) {
    return {
      isValid: false,
      error: `Average speed ${averageSpeed.toFixed(1)} km/h is unrealistic for ${transportMode}`
    };
  }

  // Validate duration vs distance
  const expectedDuration = (distance / averageSpeed) * 3600; // seconds
  const durationVariance = Math.abs(duration - expectedDuration) / expectedDuration;
  
  if (durationVariance > 0.5) { // 50% tolerance
    return {
      isValid: false,
      error: 'Trip duration does not match distance and speed'
    };
  }

  // Validate GPS path consistency
  let calculatedDistance = 0;
  for (let i = 1; i < path.length; i++) {
    const p1 = path[i - 1];
    const p2 = path[i];

    if (
      !isValidLatLon(p1?.latitude, p1?.longitude) ||
      !isValidLatLon(p2?.latitude, p2?.longitude) ||
      !isFiniteNumber(p1?.accuracy) ||
      !isFiniteNumber(p2?.accuracy) ||
      !isFiniteNumber(p1?.timestamp) ||
      !isFiniteNumber(p2?.timestamp)
    ) {
      return {
        isValid: false,
        error: 'GPS path contains invalid coordinates or metrics'
      };
    }

    // Check GPS accuracy
    if (p1.accuracy > 50 || p2.accuracy > 50) {
      return {
        isValid: false,
        error: 'GPS accuracy too poor for validation'
      };
    }

    // Calculate segment distance
    calculatedDistance += calculateDistanceFromCoords(p1, p2);
  }

  // Check if calculated distance matches reported distance
  const distanceVariance = Math.abs(calculatedDistance - distance) / distance;
  if (distanceVariance > 0.3) { // 30% tolerance
    return {
      isValid: false,
      error: 'GPS path distance does not match reported distance'
    };
  }

  return { isValid: true };
}

function calculateGpsValidationScore(path, transportMode) {
  if (!Array.isArray(path) || path.length < 2) return 0;

  let score = 100;
  let totalAccuracy = 0;
  const speeds = [];

  for (let i = 0; i < path.length; i++) {
    totalAccuracy += Number(path[i].accuracy) || 0;
  }

  const avgAccuracy = totalAccuracy / path.length;
  if (avgAccuracy > 20) score -= 20;
  else if (avgAccuracy > 10) score -= 10;

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const timeDiff = (Number(curr.timestamp) - Number(prev.timestamp)) / 1000;
    if (timeDiff <= 0) continue;
    const segmentDistance = calculateDistanceFromCoords(prev, curr);
    speeds.push((segmentDistance / timeDiff) * 3600);
  }

  if (speeds.length > 1) {
    const speedVariance = Math.max(...speeds) - Math.min(...speeds);
    if (speedVariance > 30) score -= 15;
  }

  const minGpsScore = transportMode === 'walking' || transportMode === 'bicycle' ? 80 : 75;
  return Math.max(minGpsScore, Math.min(100, Math.round(score)));
}

function validateMapRouteData(route, reportedDistance) {
  if (!isFiniteNumber(reportedDistance) || Number(reportedDistance) <= 0) {
    return { isValid: false, error: 'Reported route distance must be a positive number' };
  }

  if (!Array.isArray(route) || route.length < 2) {
    return { isValid: false, error: 'Valid route path is required' };
  }

  let routeDistance = 0;
  for (let i = 1; i < route.length; i++) {
    const p1 = route[i - 1];
    const p2 = route[i];
    if (
      !Array.isArray(p1) ||
      !Array.isArray(p2) ||
      p1.length < 2 ||
      p2.length < 2 ||
      !isValidLatLon(p1[0], p1[1]) ||
      !isValidLatLon(p2[0], p2[1])
    ) {
      return { isValid: false, error: 'Route contains invalid coordinates' };
    }
    routeDistance += calculateDistanceFromCoords(
      { latitude: Number(p1[0]), longitude: Number(p1[1]) },
      { latitude: Number(p2[0]), longitude: Number(p2[1]) }
    );
  }

  if (!Number.isFinite(routeDistance) || routeDistance <= 0) {
    return { isValid: false, error: 'Route distance could not be validated' };
  }

  const variance = Math.abs(routeDistance - reportedDistance) / reportedDistance;
  if (variance > 0.3) {
    return { isValid: false, error: 'Route distance does not match reported distance' };
  }

  return { isValid: true, routeDistance };
}

function calculateMapValidationScore(routeDistance, reportedDistance) {
  const variance = Math.abs(routeDistance - reportedDistance) / reportedDistance;
  if (variance <= 0.05) return 79;
  if (variance <= 0.1) return 75;
  if (variance <= 0.2) return 70;
  return 60;
}

function calculateDistanceFromCoords(point1, point2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.post('/api/routes/directions', readLimiter, requireAuth, async (req, res) => {
  try {
    const profile = String(req.body.profile || '').trim();
    const start = req.body.start;
    const end = req.body.end;

    if (!ORS_ALLOWED_PROFILES.has(profile)) {
      return sendResponse(res, false, null, 'Invalid route profile', 400);
    }

    if (!Array.isArray(start) || !Array.isArray(end) || start.length !== 2 || end.length !== 2) {
      return sendResponse(res, false, null, 'Invalid coordinates', 400);
    }
    if (!isValidLatLon(start[0], start[1]) || !isValidLatLon(end[0], end[1])) {
      return sendResponse(res, false, null, 'Coordinates are out of bounds', 400);
    }

    const apiKey = String(process.env.OPENROUTESERVICE_API_KEY || '').trim();
    if (!apiKey) {
      return sendResponse(
        res,
        false,
        null,
        'Routing API key not configured on server',
        503
      );
    }

    const orsResponse = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${profile}`,
      {
        coordinates: [
          [Number(start[1]), Number(start[0])],
          [Number(end[1]), Number(end[0])]
        ],
        format: 'geojson',
        units: 'km'
      },
      {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const feature = orsResponse.data?.features?.[0];
    const routeCoordsRaw = feature?.geometry?.coordinates;
    const routeDistanceMeters = feature?.properties?.segments?.[0]?.distance;

    if (!Array.isArray(routeCoordsRaw) || routeCoordsRaw.length < 2) {
      return sendResponse(res, false, null, 'Routing response missing geometry', 502);
    }

    const coordinates = routeCoordsRaw.map((coord) => [Number(coord[1]), Number(coord[0])]);
    const distanceKm = Number(routeDistanceMeters) / 1000;
    const normalizedDistance = Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(3)) : null;
    const routeTokenPayload =
      normalizedDistance != null
        ? {
            routeHash: hashRouteCoordinates(coordinates),
            distanceKm: normalizedDistance,
            profile,
            exp: Math.floor(Date.now() / 1000) + MAP_ROUTE_TOKEN_TTL_SECONDS
          }
        : null;
    const routeToken = routeTokenPayload ? await issueRouteToken(routeTokenPayload) : null;

    return sendResponse(res, true, {
      route: {
        coordinates,
        distanceKm: normalizedDistance,
        routeToken
      }
    });
  } catch (error) {
    const status = error?.response?.status;
    const upstreamMessage = error?.response?.data?.error?.message || error?.response?.data?.message;
    if (status === 429) {
      return sendResponse(
        res,
        false,
        null,
        'Routing service is rate-limiting requests. Please wait a moment and try again.',
        429
      );
    }
    console.error('Directions route error:', status || '', upstreamMessage || error.message);
    return sendResponse(res, false, null, isProd ? 'Could not calculate route' : safeErrorMessage(error, 'Could not calculate route'), 502);
  }
});

app.get('/api/leaderboard', readLimiter, async (req, res) => {
  try {
    const leaderboardRef = db.collection('leaderboard');
    const snapshot = await leaderboardRef.orderBy('totalPoints', 'desc').limit(10).get();

    const leaderboard = [];
    let rank = 1;

    snapshot.forEach((doc) => {
      const data = doc.data();
      leaderboard.push({
        rank,
        userId: data.userId,
        name: data.name,
        totalPoints: data.totalPoints || 0,
        totalCarbonSaved: data.totalCarbonSaved || 0,
        weeklyCommutes: data.weeklyCommutes || 0
      });
      rank++;
    });

    sendResponse(res, true, { leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

app.get('/api/user/:userId', readLimiter, requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId.length > 128) {
      return sendResponse(res, false, null, 'User ID is required', 400);
    }

    if (req.authUser.uid !== userId) {
      return sendResponse(res, false, null, 'Forbidden', 403);
    }

    const userData = await getUserByUid(userId);
    if (!userData) {
      return sendResponse(res, false, null, 'User not found', 404);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Single-field query only (no composite index). Filter last 7 days in memory.
    const commutesRef = db.collection('commutes');
    const commutesSnapshot = await commutesRef.where('userId', '==', userId).get();

    const weeklyCommutes = [];
    let weeklyCarbonSaved = 0;

    commutesSnapshot.forEach((doc) => {
      const commuteData = serializeCommuteDoc(doc);
      const cDate = commuteData.timestamp ? new Date(commuteData.timestamp) : null;
      if (cDate && !Number.isNaN(cDate.getTime()) && cDate >= sevenDaysAgo) {
        weeklyCommutes.push(commuteData);
        weeklyCarbonSaved += Number(commuteData.carbonSavedVsCar) || 0;
      }
    });

    weeklyCommutes.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    const [streakDoc, rewardsDoc, badgesSnap, notificationsSnap] = await Promise.all([
      db.collection('streaks').doc(userId).get(),
      db.collection('rewards').doc(userId).get(),
      db.collection('badges').where('userId', '==', userId).get(),
      db.collection('notifications').where('userId', '==', userId).get()
    ]);
    const badges = [];
    badgesSnap.forEach((d) => {
      const b = d.data() || {};
      badges.push({
        id: b.id,
        title: b.title,
        description: b.description,
        icon: b.icon,
        category: b.category,
        condition: b.condition,
        unlockedAt: normalizeToDate(b.unlockedAt)?.toISOString() || null
      });
    });
    const notifications = [];
    notificationsSnap.forEach((d) => {
      const n = d.data() || {};
      notifications.push({
        id: d.id,
        type: n.type,
        title: n.title,
        message: n.message,
        status: n.status || 'pending',
        createdAt: normalizeToDate(n.createdAt)?.toISOString() || null
      });
    });
    notifications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const streak = streakDoc.exists ? streakDoc.data() : {};
    const rewards = rewardsDoc.exists ? rewardsDoc.data() : {};
    const level = calculateLevel(rewards.totalXp || 0);
    const latestCommuteDate = weeklyCommutes[0]?.timestamp ? new Date(weeklyCommutes[0].timestamp) : null;
    const daysInactive = latestCommuteDate
      ? Math.floor((Date.now() - latestCommuteDate.getTime()) / DAY_MS)
      : 999;

    const userResponse = sanitizeUserDocForApi(userData);

    sendResponse(res, true, {
      user: {
        ...userResponse,
        weeklyData: {
          commutes: weeklyCommutes,
          carbonSaved: weeklyCarbonSaved
        },
        gamification: {
          streak: {
            currentStreak: Number(streak.currentStreak) || 0,
            bestStreak: Number(streak.bestStreak) || 0,
            streakCalendar: streak.streakCalendar || []
          },
          rewards: {
            totalXp: Number(rewards.totalXp) || 0,
            level,
            xpBreakdown: rewards.xpBreakdown || {}
          },
          badges,
          nudges: daysInactive >= 3 ? ['We miss you! Come back today to restart your eco streak.'] : [],
          notifications: notifications.slice(0, 12)
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

app.get('/api/gamification/summary/:userId', readLimiter, requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.authUser.uid !== userId) return sendResponse(res, false, null, 'Forbidden', 403);

    const [userDoc, commutesSnap, badgesSnap, rewardsDoc] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('commutes').where('userId', '==', userId).get(),
      db.collection('badges').where('userId', '==', userId).get(),
      db.collection('rewards').doc(userId).get()
    ]);
    if (!userDoc.exists) return sendResponse(res, false, null, 'User not found', 404);

    const sevenDaysAgo = Date.now() - 7 * DAY_MS;
    const weekCommutes = [];
    let weekCarbonSaved = 0;
    commutesSnap.forEach((doc) => {
      const data = doc.data() || {};
      const ts = normalizeToDate(data.timestamp);
      if (ts && ts.getTime() >= sevenDaysAgo) {
        weekCommutes.push(data);
        weekCarbonSaved += Number(data.carbonSavedVsCar) || 0;
      }
    });

    const rewards = rewardsDoc.exists ? rewardsDoc.data() : {};
    const summary = generateWeeklySummary({
      weekCommutes,
      weekCarbonSaved,
      weekXp: rewards.xpBreakdown?.totalXp || 0,
      percentile: 80,
      unlockedBadges: badgesSnap.size
    });

    return sendResponse(res, true, { summary });
  } catch (error) {
    console.error('Gamification summary error:', error);
    return sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

app.get('/api/gamification/badges/:userId', readLimiter, requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.authUser.uid !== userId) return sendResponse(res, false, null, 'Forbidden', 403);
    const snapshot = await db.collection('badges').where('userId', '==', userId).get();
    const badges = [];
    snapshot.forEach((doc) => {
      const b = doc.data() || {};
      badges.push({
        id: b.id,
        title: b.title,
        description: b.description,
        icon: b.icon,
        category: b.category,
        condition: b.condition,
        unlockedAt: normalizeToDate(b.unlockedAt)?.toISOString() || null
      });
    });
    return sendResponse(res, true, { badges });
  } catch (error) {
    console.error('Badges fetch error:', error);
    return sendResponse(res, false, null, safeErrorMessage(error), 500);
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  sendResponse(res, false, null, 'Internal server error', 500);
});

app.listen(PORT, () => {
  console.log(`Carbon Gamified API listening on port ${PORT} (${isProd ? 'production' : 'development'})`);
});
