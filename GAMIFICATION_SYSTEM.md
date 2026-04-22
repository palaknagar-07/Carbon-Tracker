# Gamification + Habit Building System

## Updated Firestore Schema

### `users/{userId}`
- `uid`, `email`, `name`, `profilePicture`
- `totalPoints`, `totalCarbonSaved`, `weeklyCommutes`
- `joinDate`, `lastUpdate`

### `commutes/{commuteId}`
- `userId`, `transportMode`, `distance`
- `carbonEmitted`, `carbonSavedVsCar`, `pointsEarned`
- `validationMethod`, `validationScore`
- `timestamp`, optional route/tracking fields

### `badges/{userId_badgeId}`
- `userId`
- `id`, `title`, `description`, `icon`, `category`
- `condition` (unlock condition object)
- `unlockedAt`

### `streaks/{userId}`
- `userId`
- `currentStreak`, `bestStreak`
- `days` (YYYY-MM-DD list)
- `streakCalendar` (recent display days)
- `lastLoggedDate`, `updatedAt`

### `rewards/{userId}`
- `userId`
- `totalXp`
- `level`, `levelTitle`, `progressPercent`
- `xpBreakdown` `{ commuteXp, streakBonus, challengeBonus, badgeBonus, totalXp }`
- `lastEarnedAt`

### `notifications/{notificationId}`
- `userId`
- `type` (`daily_reminder`, `streak_reset`, `weekly_summary`, `nudge`)
- `title`, `message`
- `status` (`pending`, `sent`, `read`)
- `createdAt`

## Backend API Routes

- `GET /api/gamification/summary/:userId` - weekly summary payload
- `GET /api/gamification/badges/:userId` - unlocked badges
- `GET /api/user/:userId` - now includes `user.gamification`:
  - `streak`, `rewards`, `badges`, `nudges`, `notifications`
- Existing commute APIs now return `gamification` block after each log:
  - `/api/commute`
  - `/api/commute/tracked`
  - `/api/commute/routed`

## React Components Structure

- `Dashboard`
  - `CommuteLogger`
  - `Leaderboard`
  - `GamificationHub` (new)
    - Streak widget + mini calendar
    - Rewards/XP level progress bar
    - Badge showcase grid
    - Celebration modal
    - Habit nudges + weekly summary section
    - Share card modal/action (PNG download)

## Best Folder Structure

```text
backend/
  server.js
  gamification-service.js
  carbon-calculator.js
  firebase-config.js

frontend/src/
  components/
    Dashboard.js
    GamificationHub.js
    GamificationHub.css
    CommuteLogger.js
    Leaderboard.js
  api/client.js
```

## Deployment Steps

1. Set backend env vars (`FIREBASE_*`, `OPENROUTESERVICE_API_KEY`, CORS vars).
2. Deploy backend (`npm install && npm start`) on Render/Railway/Fly/Cloud Run.
3. Set `REACT_APP_API_URL` to deployed backend URL.
4. Build frontend (`npm install && npm run build`) and deploy (Vercel/Netlify/Firebase Hosting).
5. Ensure Firestore indexes deployed from `firestore.indexes.json`.
6. Validate auth + commute logging + badge unlock + share card download in production domain.
