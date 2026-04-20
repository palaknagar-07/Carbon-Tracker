import React, { useState, useEffect } from 'react';
import api from '../api/client';
import './Leaderboard.css';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await api.get('/api/leaderboard');
      if (response.data.success) {
        setLeaderboard(response.data.leaderboard);
      } else {
        setError('Failed to fetch leaderboard');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => num.toLocaleString();

  const getMedal = (rank) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getRankClass = (rank) => {
    if (rank <= 3) return 'rank-top-three';
    return '';
  };

  if (loading) {
    return (
      <div className="content leaderboard">
        <div className="loading">Loading leaderboard…</div>
      </div>
    );
  }

  return (
    <div className="content leaderboard">
      <div className="section-title">Rankings</div>
      <div className="leaderboard-header">
        <h2>Leaderboard</h2>
        <p>Top contributors by eco points</p>
      </div>

      {error && <div className="error">{error}</div>}

      {leaderboard.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌱</div>
          <h3>No entries yet</h3>
          <p>Log a commute to appear on the board.</p>
        </div>
      ) : (
        <div className="leaderboard-table">
          <div className="table-header">
            <div className="header-cell rank">Rank</div>
            <div className="header-cell name">Name</div>
            <div className="header-cell points">Points</div>
            <div className="header-cell carbon">CO₂ saved</div>
            <div className="header-cell commutes">Trips</div>
          </div>

          <div className="table-body">
            {leaderboard.map((row, index) => (
              <div
                key={row.userId || `row-${index}`}
                className={`table-row ${getRankClass(index + 1)}`}
              >
                <div className="cell rank">
                  <span className="medal">{getMedal(index + 1)}</span>
                </div>
                <div className="cell name">
                  <span className="user-name">{row.name}</span>
                </div>
                <div className="cell points">
                  <span className="points-value">{formatNumber(row.totalPoints)}</span>
                </div>
                <div className="cell carbon">
                  <span className="carbon-value">{formatNumber(row.totalCarbonSaved.toFixed(1))} kg</span>
                </div>
                <div className="cell commutes">
                  <span className="commutes-value">{row.weeklyCommutes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="leaderboard-footer">
        <p>Refreshes every 5 seconds</p>
      </div>
    </div>
  );
};

export default Leaderboard;
