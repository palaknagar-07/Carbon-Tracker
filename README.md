# 🌱 Carbon Gamified - Eco-Friendly Commute Tracker

A gamified carbon footprint calculator where users log daily commutes, earn points for eco-friendly choices, and compete on a global leaderboard.

## 🚀 Features

- **🔐 Authentication**: Email/password signup and login
- **🚴 Commute Logger**: Track daily commutes with 6 transport modes
- **📊 Dashboard**: View personal stats and environmental impact
- **🏆 Global Leaderboard**: Compete with users worldwide
- **🌱 Points System**: Earn points based on carbon saved vs driving
- **📱 Responsive Design**: Mobile-friendly glassmorphic UI

## 🛠 Tech Stack

### Frontend
- **React.js** - UI framework
- **CSS3** - Modern styling with glassmorphism
- **Axios** - HTTP client for API calls

### Backend
- **Node.js/Express.js** - REST API server
- **Firebase Firestore** - NoSQL database
- **Firebase Admin SDK** - Server-side Firebase integration
- **bcryptjs** - Password hashing

### Database
- **Firebase Firestore** - Users, commutes, and leaderboard data
- **Firebase Authentication** - User management

## 📋 Project Structure

```
carbon-gamified-app/
├── frontend/                 # React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.js
│   │   │   ├── Dashboard.js
│   │   │   ├── CommuteLogger.js
│   │   │   └── Leaderboard.js
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── package.json
│   └── .env.example
├── backend/                  # Node.js backend
│   ├── server.js
│   ├── firebase-config.js
│   ├── carbon-calculator.js
│   ├── package.json
│   ├── .env.example
│   └── serviceAccountKey.json.example
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase project

### 1. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Create a service account:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
4. Copy the service account key to `backend/serviceAccountKey.json`

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Firebase credentials
npm start
```

The backend will run on `http://localhost:3001`

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your Firebase config
npm start
```

The frontend will run on `http://localhost:3000`

## 🎮 How to Use

### Demo Account
Use the demo credentials to quickly test the app:
- **Email**: demo@test.com
- **Password**: Demo123!

### Features

1. **Sign Up/Login**: Create an account or use demo credentials
2. **Log Commute**: 
   - Select transport mode (Car, Motorcycle, Bus, Train, Bicycle, Walking)
   - Enter distance in kilometers
   - View carbon savings and points earned
3. **Dashboard**: 
   - View total points and carbon saved
   - See weekly commute statistics
   - Check environmental impact in tree equivalents
4. **Leaderboard**: 
   - View top 10 global users
   - See rankings by total points
   - Auto-refreshes every 5 seconds

## 📊 Carbon Calculation

Carbon emission factors (grams CO₂ per km):
- 🚗 Car: 192g CO₂/km
- 🏍️ Motorcycle: 84g CO₂/km
- 🚌 Bus: 89g CO₂/km
- 🚆 Train: 34g CO₂/km
- 🚴 Bicycle: 0g CO₂/km
- 🚶 Walking: 0g CO₂/km

**Points Calculation**: `Points = (Carbon Saved vs Car) × 0.1`

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/login` - User login

### Commutes
- `POST /api/commute` - Log a new commute

### Data
- `GET /api/user/:userId` - Get user data and stats
- `GET /api/leaderboard` - Get top 10 users
- `GET /api/health` - Health check

## 🎨 Design System

### Colors
- **Primary Gradient**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Success Green**: `#51cf66`
- **Danger Red**: `#ff6b6b`
- **Gold**: `#ffd700`

### Effects
- **Glassmorphism**: `backdrop-filter: blur(10px)`
- **Shadows**: `0 8px 32px rgba(0,0,0,0.1)`
- **Transitions**: `all 0.3s ease`

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Replit)
1. Upload backend files to Replit
2. Set environment variables in Replit secrets
3. Start the server

## 🧪 Testing

### Manual Testing Checklist
- [ ] Signup works with new email
- [ ] Login works with existing account
- [ ] Cannot login with wrong password
- [ ] Can log commute with all 6 transport modes
- [ ] Points calculated correctly
- [ ] Leaderboard updates after new commute
- [ ] Dashboard stats are accurate
- [ ] Weekly data calculated correctly
- [ ] All tabs navigate properly
- [ ] Logout clears session
- [ ] Mobile responsive design
- [ ] No console errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🌱 Environmental Impact

This app helps users:
- Track their carbon footprint
- Make eco-friendly transport choices
- Compete to reduce environmental impact
- Visualize their contribution to sustainability

**Remember**: Every small change counts towards a greener future! 🌍
