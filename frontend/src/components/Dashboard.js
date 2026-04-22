import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import CommuteLogger from './CommuteLogger';
import Leaderboard from './Leaderboard';
import TripDetails from './TripDetails';
import GamificationHub from './GamificationHub';
import './Dashboard.css';

const MOTIVATIONAL_TAGLINES = [
  'Start logging for a better future.',
  'Every commute counts toward a greener planet.',
  'Your small actions create big environmental change.'
];

const ECO_TIPS = [
  'Use public transport once a week to reduce emissions.',
  'Walking short distances improves health and helps the planet.',
  'Carpooling saves fuel and lowers traffic congestion.',
  'Cycling daily reduces your carbon footprint significantly.'
];

const ECO_FACTS = [
  'Transportation contributes nearly 20% of global CO2 emissions.',
  'One person switching to cycling can save hundreds of kg of CO2 yearly.',
  'Trees absorb around 22 kg of CO2 per year on average.',
  'Shared rides reduce road congestion and emissions.'
];

function parseCommuteDate(c) {
  const t = c?.timestamp;
  if (t == null) return null;
  if (typeof t === 'string' || typeof t === 'number') {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof t === 'object' && t._seconds != null) return new Date(t._seconds * 1000);
  if (typeof t === 'object' && t.seconds != null) return new Date(t.seconds * 1000);
  return null;
}

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userStats, setUserStats] = useState({
    totalPoints: 0,
    totalCarbonSaved: 0,
    weeklyCommutes: 0,
    treesPlanted: 0,
    todayEmittedKg: 0,
    weekSavedKg: 0
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [tripDetailsData, setTripDetailsData] = useState(null);
  const [tripTransportMode, setTripTransportMode] = useState('');
  const [tripDistance, setTripDistance] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [factIndices, setFactIndices] = useState([0, 1]);
  const [gamificationData, setGamificationData] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);

  const fetchUserStats = useCallback(async () => {
    if (!user?.userId) {
      setFetchError('Missing account id. Please log out and sign in again.');
      setLoading(false);
      return;
    }

    setFetchError('');
    setLoading(true);
    try {
      const response = await api.get(`/api/user/${encodeURIComponent(user.userId)}`);
      const body = response.data;

      if (!body?.success) {
        setFetchError(body?.message || 'Could not load your dashboard data.');
        return;
      }

      const userData = body.user;
      if (!userData) {
        setFetchError('Server returned no user profile.');
        return;
      }

      const commutes = userData.weeklyData?.commutes || [];
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let todayEmittedKg = 0;
      commutes.forEach((c) => {
        const d = parseCommuteDate(c);
        if (d && d >= startOfDay) {
          todayEmittedKg += Number(c.carbonEmitted) || 0;
        }
      });

      const weekSavedKg = Number(userData.weeklyData?.carbonSaved) || 0;

      setUserStats({
        totalPoints: Number(userData.totalPoints) || 0,
        totalCarbonSaved: Number(userData.totalCarbonSaved) || 0,
        weeklyCommutes: Number(userData.weeklyCommutes) || 0,
        treesPlanted: Math.round((Number(userData.totalCarbonSaved) || 0) / 21),
        todayEmittedKg,
        weekSavedKg
      });
      setGamificationData(userData.gamification || null);
      const summaryRes = await api.get(`/api/gamification/summary/${encodeURIComponent(user.userId)}`);
      if (summaryRes.data?.success) {
        setWeeklySummary(summaryRes.data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      const msg =
        error.response?.data?.message ||
        (error.code === 'ECONNABORTED' ? 'Request timed out.' : null) ||
        error.message ||
        'Could not reach the server. Is the API running?';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    fetchUserStats();
  }, [fetchUserStats]);

  useEffect(() => {
    const todaySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const initialTip = todaySeed % ECO_TIPS.length;
    const firstFact = todaySeed % ECO_FACTS.length;
    const secondFact = (firstFact + 1) % ECO_FACTS.length;
    setTipIndex(initialTip);
    setFactIndices([firstFact, secondFact]);
  }, []);

  useEffect(() => {
    const rotate = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ECO_TIPS.length);
      setFactIndices((prev) => {
        const nextFirst = (prev[0] + 1) % ECO_FACTS.length;
        const nextSecond = (nextFirst + 1) % ECO_FACTS.length;
        return [nextFirst, nextSecond];
      });
    }, 12000);
    return () => clearInterval(rotate);
  }, []);

  
  const handleCommuteLogged = (tripData = null, transportMode = '', distance = 0) => {
    fetchUserStats();
    
    if (tripData) {
      setTripDetailsData(tripData);
      setTripTransportMode(transportMode);
      setTripDistance(distance);
      setShowTripDetails(true);
    }
  };

  const handleBackToDashboard = () => {
    setShowTripDetails(false);
    setTripDetailsData(null);
    setTripTransportMode('');
    setTripDistance(0);
    setActiveTab('dashboard');
  };

  const formatNumber = (num) => num.toLocaleString();
  const currentHour = new Date().getHours();
  const greetingPrefix = currentHour < 12 ? 'Good Morning' : currentHour < 18 ? 'Good Afternoon' : 'Good Evening';
  const greetingEmoji = currentHour < 12 ? '☀️' : currentHour < 18 ? '🌿' : '🌙';
  const displayName = user?.name || 'Eco Hero';
  const tagline = MOTIVATIONAL_TAGLINES[(tipIndex + 1) % MOTIVATIONAL_TAGLINES.length];

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="header-content">
          <h1>Carbon Tracker</h1>
          <p>Track your daily carbon footprint and make eco-conscious choices</p>
        </div>
        <div className="user-section">
          <div className="user-email">
            <span className="user-name-label">{user.name || 'User'}</span>
            <span className="user-email-sub">{user.email}</span>
          </div>
          <button type="button" className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'commute' ? 'active' : ''}`}
          onClick={() => setActiveTab('commute')}
        >
          Log Commute
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'gamification' ? 'active' : ''}`}
          onClick={() => setActiveTab('gamification')}
        >
          Rewards
        </button>
      </div>

      {fetchError && (
        <div className="error dashboard-fetch-error" role="alert">
          {fetchError}
          <button type="button" className="dashboard-retry-btn" onClick={() => fetchUserStats()}>
            Retry
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="content dashboard-panel">
          <section className="welcome-hero">
            <div className="welcome-copy">
              <h2>{`${greetingPrefix}, ${displayName} ${greetingEmoji}`}</h2>
              <p>{tagline}</p>
              <span className="welcome-cta">Choose any method below to continue your eco streak.</span>
            </div>
            <div className="welcome-badge" aria-hidden="true">🌎</div>
          </section>

          <section className="insight-row">
            <article className="insight-card tip-card">
              <div className="insight-kicker">Daily Sustainability Tip</div>
              <p key={`tip-${tipIndex}`} className="insight-text fade-in">{ECO_TIPS[tipIndex]}</p>
            </article>
            <article className="insight-card facts-card">
              <div className="insight-kicker">Eco Facts</div>
              <div className="fact-list">
                <p key={`fact-a-${factIndices[0]}`} className="insight-text fade-in">
                  {ECO_FACTS[factIndices[0]]}
                </p>
                <p key={`fact-b-${factIndices[1]}`} className="insight-text fade-in">
                  {ECO_FACTS[factIndices[1]]}
                </p>
              </div>
            </article>
          </section>

          <div className="section-title">Overview</div>
          <div className="stats-grid dash-stats">
            <div className="stat-card">
              <div className="stat-label">Today&apos;s emissions</div>
              <div className="stat-value">{formatNumber(userStats.todayEmittedKg.toFixed(2))}</div>
              <div className="stat-unit">kg CO₂ (this trip type)</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">This week saved</div>
              <div className="stat-value">{formatNumber(userStats.weekSavedKg.toFixed(1))}</div>
              <div className="stat-unit">kg vs driving</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Points earned</div>
              <div className="stat-value">{formatNumber(userStats.totalPoints)}</div>
              <div className="stat-unit">eco points</div>
            </div>
          </div>

          <div className="section-title">Lifetime &amp; impact</div>
          <div className="stats-grid dash-stats secondary-stats">
            <div className="stat-card">
              <div className="stat-label">Total CO₂ saved</div>
              <div className="stat-value">{formatNumber(userStats.totalCarbonSaved.toFixed(1))}</div>
              <div className="stat-unit">kg vs car</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Trips logged</div>
              <div className="stat-value">{formatNumber(userStats.weeklyCommutes)}</div>
              <div className="stat-unit">all time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Trees equivalent</div>
              <div className="stat-value">{formatNumber(userStats.treesPlanted)}</div>
              <div className="stat-unit">~21 kg CO₂ / tree</div>
            </div>
          </div>

          <div className="impact-block">
            <div className="impact-card">
              <h3>vs driving alone</h3>
              <p>
                You&apos;ve avoided about{' '}
                <strong>{formatNumber(userStats.totalCarbonSaved.toFixed(1))} kg</strong> of CO₂
                compared to using a car for the same trips.
              </p>
            </div>
            <div className="impact-card">
              <h3>Tree impact</h3>
              <p>
                Roughly equivalent to <strong>{userStats.treesPlanted}</strong> trees absorbing CO₂
                for a year (illustrative).
              </p>
            </div>
          </div>
        </div>
      )}

      {showTripDetails ? (
        <TripDetails
          tripData={tripDetailsData}
          transportMode={tripTransportMode}
          distance={tripDistance}
          userStats={userStats}
          onBack={handleBackToDashboard}
          onNavigateToLeaderboard={() => {
            console.log('Navigating to leaderboard from trip details');
            setShowTripDetails(false);
            setActiveTab('leaderboard');
          }}
          onLogAnotherTrip={() => {
            console.log('Navigating to commute logging from trip details');
            setShowTripDetails(false);
            setActiveTab('commute');
          }}
        />
      ) : (
        <>
          {activeTab === 'commute' && (
            <CommuteLogger user={user} onCommuteLogged={handleCommuteLogged} />
          )}

          {activeTab === 'leaderboard' && <Leaderboard />}
          {activeTab === 'gamification' && (
            <GamificationHub
              data={gamificationData}
              weeklySummary={weeklySummary}
              userName={displayName}
              profileStats={userStats}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
