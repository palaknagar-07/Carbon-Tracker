const admin = require('firebase-admin');

const CARBON_FACTORS = {
  car: 192,
  motorcycle: 84,
  bus: 89,
  train: 34,
  bicycle: 0,
  walking: 0
};

function loadServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON');
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const hasValidEnvKey =
    projectId &&
    clientEmail &&
    privateKey &&
    /BEGIN [A-Z ]+PRIVATE KEY/.test(privateKey);

  if (hasValidEnvKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    return {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail
    };
  }

  try {
    return require('./serviceAccountKey.json');
  } catch {
    throw new Error(
      'Firebase Admin credentials missing. For production set FIREBASE_SERVICE_ACCOUNT_JSON ' +
        'or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY. ' +
        'For local dev you can use backend/serviceAccountKey.json (never commit it).'
    );
  }
}

const useMock =
  process.env.NODE_ENV !== 'production' && process.env.USE_MOCK_FIRESTORE === 'true';

if (useMock) {
  console.warn('USE_MOCK_FIRESTORE=true — using in-memory mock (not for production)');

  const mockFirestore = () => {
    const data = {
      users: new Map(),
      commutes: new Map(),
      leaderboard: new Map()
    };

    const docApi = (collectionName, id) => ({
      get: async () => {
        const docData = data[collectionName].get(id);
        return docData ? { exists: true, data: () => docData } : { exists: false };
      },
      set: async (docData, options) => {
        if (options && options.merge) {
          const existing = data[collectionName].get(id) || {};
          data[collectionName].set(id, { ...existing, ...docData });
        } else {
          data[collectionName].set(id, docData);
        }
      },
      update: async (updates) => {
        const existing = data[collectionName].get(id) || {};
        data[collectionName].set(id, { ...existing, ...updates });
      }
    });

    return {
      collection: (name) => ({
        doc: (id) => {
          const resolvedId =
            id === undefined || id === null || id === ''
              ? `auto_${Date.now()}_${Math.random().toString(36).slice(2)}`
              : id;
          return docApi(name, resolvedId);
        },
        where: (field, op, value) => ({
          get: async () => {
            const results = [];
            for (const [docId, doc] of data[name]) {
              if (op === '==' && doc[field] === value) {
                results.push({
                  id: docId,
                  data: () => doc
                });
              }
            }
            return {
              empty: results.length === 0,
              forEach: (cb) => results.forEach(cb)
            };
          }
        }),
        orderBy: (field, direction) => ({
          limit: (count) => ({
            get: async () => {
              const rows = Array.from(data[name].entries()).map(([docId, row]) => ({
                id: docId,
                data: () => row
              }));
              rows.sort((a, b) =>
                direction === 'desc'
                  ? b.data()[field] - a.data()[field]
                  : a.data()[field] - b.data()[field]
              );
              const slice = rows.slice(0, count);
              return {
                forEach: (cb) => slice.forEach(cb)
              };
            }
          })
        })
      })
    };
  };

  const db = mockFirestore();

  module.exports = {
    db,
    CARBON_FACTORS,
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => new Date()
        }
      }
    }
  };
} else {
  const serviceAccount = loadServiceAccount();

  if (!admin.apps.length) {
    const init = {
      credential: admin.credential.cert(serviceAccount)
    };
    const dbUrl = process.env.FIREBASE_DATABASE_URL;
    if (dbUrl) init.databaseURL = dbUrl;
    admin.initializeApp(init);
  }

  const db = admin.firestore();

  module.exports = {
    db,
    CARBON_FACTORS,
    admin
  };
}
