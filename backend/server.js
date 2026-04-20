require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { db, admin } = require('./firebase-config');
const { calculateCarbon, isValidTransportMode } = require('./carbon-calculator');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

const MAX_COMMUTE_DISTANCE_KM = Number(process.env.MAX_COMMUTE_DISTANCE_KM) || 5000;
const MAX_NAME_LENGTH = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORS_ALLOWED_PROFILES = new Set(['driving-car', 'cycling-regular', 'foot-walking']);
const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY || '';

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
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
    sendResponse(res, false, null, isProd ? 'Internal server error' : error.message, 500);
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
    const distance = parseFloat(String(req.body.distance), 10);

    if (!userId || !transportMode || req.body.distance === undefined || req.body.distance === null) {
      return sendResponse(res, false, null, 'All fields are required', 400);
    }

    if (!isValidTransportMode(transportMode)) {
      return sendResponse(res, false, null, 'Invalid transport mode', 400);
    }

    if (!Number.isFinite(distance) || distance <= 0) {
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

    const updatedStats = await updateUserStats(
      userId,
      carbonCalculation.pointsEarned,
      carbonCalculation.carbonSavedVsCar
    );

    if (!updatedStats) {
      return sendResponse(res, false, null, 'Failed to update user stats', 500);
    }

    sendResponse(res, true, {
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: carbonCalculation.pointsEarned,
      newTotalPoints: updatedStats.newTotalPoints
    });
  } catch (error) {
    console.error('Commute logging error:', error);
    sendResponse(res, false, null, isProd ? 'Internal server error' : error.message, 500);
  }
});

// New endpoint for GPS-tracked commutes
app.post('/api/commute/tracked', commuteLimiter, requireAuth, async (req, res) => {
  try {
    const userId = String(req.authUser.uid || '').trim();
    const { 
      transportMode, 
      distance, 
      duration, 
      averageSpeed, 
      validationScore, 
      path, 
      startTime, 
      endTime 
    } = req.body;

    if (!userId || !transportMode || !distance || !duration || !path || !startTime || !endTime) {
      return sendResponse(res, false, null, 'All tracking fields are required', 400);
    }

    if (!isValidTransportMode(transportMode)) {
      return sendResponse(res, false, null, 'Invalid transport mode', 400);
    }

    if (!Number.isFinite(distance) || distance <= 0) {
      return sendResponse(res, false, null, 'Distance must be a positive number', 400);
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      return sendResponse(res, false, null, 'Duration must be a positive number', 400);
    }

    if (!Array.isArray(path) || path.length < 2) {
      return sendResponse(res, false, null, 'Valid GPS path is required', 400);
    }

    // Validate GPS data
    const validationResults = validateTripData(path, transportMode, distance, duration, averageSpeed);
    
    if (!validationResults.isValid) {
      return sendResponse(res, false, null, validationResults.error, 400);
    }

    const carbonCalculation = calculateCarbon(transportMode, distance);

    // Bonus points for validated trips
    const bonusMultiplier = validationScore >= 80 ? 1.5 : validationScore >= 60 ? 1.2 : 1.0;
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
      validationScore,
      duration,
      averageSpeed,
      path: path.slice(0, 100), // Limit stored points to save storage
      startTime: admin.firestore.Timestamp.fromMillis(startTime),
      endTime: admin.firestore.Timestamp.fromMillis(endTime),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedStats = await updateUserStats(
      userId,
      adjustedPoints,
      carbonCalculation.carbonSavedVsCar
    );

    if (!updatedStats) {
      return sendResponse(res, false, null, 'Failed to update user stats', 500);
    }

    sendResponse(res, true, {
      carbonEmitted: carbonCalculation.carbonEmitted,
      carbonSavedVsCar: carbonCalculation.carbonSavedVsCar,
      pointsEarned: adjustedPoints,
      basePoints: carbonCalculation.pointsEarned,
      validationScore,
      bonusMultiplier,
      newTotalPoints: updatedStats.newTotalPoints
    });
  } catch (error) {
    console.error('Tracked commute error:', error);
    sendResponse(res, false, null, isProd ? 'Internal server error' : error.message, 500);
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

    if (
      !Array.isArray(start) ||
      !Array.isArray(end) ||
      start.length !== 2 ||
      end.length !== 2 ||
      !Number.isFinite(Number(start[0])) ||
      !Number.isFinite(Number(start[1])) ||
      !Number.isFinite(Number(end[0])) ||
      !Number.isFinite(Number(end[1]))
    ) {
      return sendResponse(res, false, null, 'Invalid coordinates', 400);
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

    return sendResponse(res, true, {
      route: {
        coordinates,
        distanceKm: Number.isFinite(distanceKm) ? distanceKm : null
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
    return sendResponse(res, false, null, 'Could not calculate route', 502);
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
    sendResponse(res, false, null, isProd ? 'Internal server error' : error.message, 500);
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

    const userResponse = sanitizeUserDocForApi(userData);

    sendResponse(res, true, {
      user: {
        ...userResponse,
        weeklyData: {
          commutes: weeklyCommutes,
          carbonSaved: weeklyCarbonSaved
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    sendResponse(res, false, null, isProd ? 'Internal server error' : error.message, 500);
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
