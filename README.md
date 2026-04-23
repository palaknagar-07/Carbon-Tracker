# Carbon Tracker

Carbon Tracker is a gamified commute logging app that helps users record trips, compare transport choices against driving, and build repeat eco-friendly habits through streaks, badges, XP, and leaderboard progress.

## Current Functionality

- Firebase Authentication with email/password and Google sign-in
- Session establishment through the backend using verified Firebase ID tokens
- Three commute logging flows:
  - manual distance entry
  - map-based route logging with route validation
  - live GPS tracking
- Carbon calculations for car, motorcycle, bus, train, bicycle, and walking
- Dashboard with total points, carbon saved, weekly activity, tree-equivalent style impact, and nudges
- Gamification layer with streaks, levels, XP, badges, weekly summary, and leaderboard rank
- Leaderboard with auto-refresh
- FAQ and shareable profile card experience

## Product Notes

- GPS live tracking is included and partially working, but it should still be treated as a demo-stage feature.
- Manual entry and map-based route logging are the strongest user flows today.
- Existing stored user XP is not automatically recalculated when XP formulas change; new trips use the latest backend logic.

## Tech Stack

- Frontend: React, Create React App, React Router, Axios, Leaflet, React Leaflet, CSS
- Backend: Node.js, Express, Axios, dotenv, helmet, cors, express-rate-limit
- Auth and data: Firebase Authentication, Cloud Firestore, Firebase Admin SDK
- Routing and geocoding: OpenRouteService, Nominatim / OpenStreetMap
- Deployment: Vercel for the frontend, Render for the backend

## Repository Structure

```text
.
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── utils/
│   │   ├── App.js
│   │   └── firebase.js
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── server.js
│   ├── firebase-config.js
│   ├── gamification-service.js
│   ├── carbon-calculator.js
│   ├── .env.example
│   └── package.json
├── firestore.indexes.json
└── README.md
```

## Local Development

### Prerequisites

- Node.js 18+
- npm
- A Firebase project
- An OpenRouteService API key for route validation

### 1. Install Dependencies

From the repository root:

```bash
npm run install:all
```

Or install per app:

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configure Environment Variables

Copy the example files:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

#### Frontend Variables

Set these in `frontend/.env`:

- `REACT_APP_API_URL`
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID` if available
- `REACT_APP_NOMINATIM_EMAIL` or `REACT_APP_CONTACT_EMAIL` optionally

#### Backend Variables

Set these in `backend/.env`:

- `NODE_ENV`
- `ALLOWED_ORIGINS`
- `OPENROUTESERVICE_API_KEY`
- `ROUTE_TOKEN_SECRET` recommended
- One Firebase Admin credential approach:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

Optional backend tuning variables are listed in `backend/.env.example`.

### 3. Firebase Setup

In Firebase Console:

- create or open a Firebase project
- enable Authentication
- enable Email/Password if you want email login
- enable Google if you want Google sign-in
- enable Firestore
- create a Web App and copy the client config into the frontend env file
- create a service account key or use service account env vars for the backend
- add your frontend domain to Firebase Authentication authorized domains

### 4. Start the Apps

Backend:

```bash
cd backend
npm start
```

Frontend:

```bash
cd frontend
npm start
```

Or from the repo root:

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Current User Flow

1. User signs up or signs in with Firebase Auth.
2. Frontend exchanges the Firebase identity with the backend through `POST /api/auth/session`.
3. User logs a commute manually, through a validated map route, or through live GPS tracking.
4. Backend calculates:
   - carbon emitted
   - carbon saved versus driving
   - points earned
   - validation score and any validation bonus
   - XP, streak, badges, and level progress
5. Dashboard and leaderboard update from Firestore-backed data.

## Carbon and Reward Logic

### Carbon Factors

- Car: `192 g CO2/km`
- Motorcycle: `84 g CO2/km`
- Bus: `89 g CO2/km`
- Train: `34 g CO2/km`
- Bicycle: `0 g CO2/km`
- Walking: `0 g CO2/km`

### Base Points

Base commute points are calculated from carbon saved versus driving:

```text
pointsEarned = round(carbonSavedVsCarKg * 50)
```

### XP

Current XP award logic lives in `backend/gamification-service.js`:

```text
commuteXp = min(round(commutePoints * 0.2), 50)
badgeBonus = min(badgeUnlockCount * 40, 100)
challengeBonus = min(challengeBonus, 40)
streakBonus = min(streakBonus, 30)
totalXp = min(commuteXp + badgeBonus + challengeBonus + streakBonus, 150)
```

### Current Level Thresholds

- Level 1: `0 XP`
- Level 2: `1000 XP`
- Level 3: `2500 XP`
- Level 4: `5500 XP`
- Level 5: `11500 XP`

## API Surface

### Active Endpoints

- `GET /api/health`
- `POST /api/auth/session`
- `POST /api/commute`
- `POST /api/commute/tracked`
- `POST /api/commute/routed`
- `POST /api/routes/directions`
- `GET /api/leaderboard`
- `GET /api/user/:userId`
- `GET /api/gamification/summary/:userId`
- `GET /api/gamification/badges/:userId`

### Deprecated Endpoints

These still exist in the backend but return deprecated responses and are not used by the frontend:

- `POST /api/auth/login`
- `POST /api/auth/check-user`
- `POST /api/auth/google-login`

## Deployment

### Frontend on Vercel

- Root Directory: `frontend`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `build`

Required Vercel environment variables:

- `REACT_APP_API_URL`
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID` if available

### Backend on Render

- Root Directory: `backend`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

Recommended Render environment variables:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS=<your-vercel-url>`
- `TRUST_PROXY=1`
- `OPENROUTESERVICE_API_KEY=<your-key>`
- `ROUTE_TOKEN_SECRET=<your-random-secret>`
- `FIREBASE_SERVICE_ACCOUNT_JSON=<full-json>`

## Testing

Backend tests:

```bash
cd backend
npm test
```

Current automated coverage includes:

- gamification and XP calculations
- weekly summary aggregation
- streak behavior
- route serialization
- trip limit helpers
- impact-equivalent helpers

## Limitations

- GPS tracking reliability depends on browser permissions, HTTPS, and signal quality.
- GPS tracking is not yet a production-grade anti-cheat system.
- Leaderboard and profile reads are optimized for the current project size, not large-scale production traffic.
- Map route validation depends on third-party routing availability.

## License

MIT
