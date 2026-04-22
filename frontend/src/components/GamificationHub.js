import React, { useMemo, useState } from 'react';
import './GamificationHub.css';

const SHARE_TYPES = [
  { id: 'streak', label: 'Streak Card' },
  { id: 'carbon', label: 'Carbon Saved Card' },
  { id: 'leaderboard', label: 'Leaderboard Card' },
  { id: 'level', label: 'Level Card' }
];

function drawShareCard({ type, stats, level, rank }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, '#113d2d');
  grad.addColorStop(1, '#2d6a4f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(80, 80, 920, 920);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px Inter, Arial';
  ctx.fillText('Carbon Tracker', 140, 190);
  ctx.font = '500 40px Inter, Arial';

  const lineByType = {
    streak: `${stats.currentStreak || 0} Day Green Streak`,
    carbon: `Saved ${(stats.totalCarbonSaved || 0).toFixed(1)} kg CO2`,
    leaderboard: rank ? `Top ${rank} on Leaderboard` : 'Climbing the Leaderboard',
    level: `${level.levelTitle} Level ${level.level}`
  };
  ctx.fillText(lineByType[type], 140, 310);
  ctx.font = '400 34px Inter, Arial';
  ctx.fillText(`XP: ${level.currentXp} | Best Streak: ${stats.bestStreak || 0}`, 140, 390);
  ctx.fillText('Keep commuting greener every day.', 140, 470);
  ctx.font = '400 28px Inter, Arial';
  ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, 140, 930);
  return canvas.toDataURL('image/png');
}

const GamificationHub = ({ data, weeklySummary }) => {
  const [showCelebration, setShowCelebration] = useState(Boolean(data?.badges?.length));
  const [shareType, setShareType] = useState('streak');
  const streak = data?.streak || {};
  const rewards = data?.rewards || {};
  const level = rewards.level || { level: 1, levelTitle: 'Seedling', progressPercent: 0, currentXp: 0 };
  const rank = data?.rank || null;

  const groupedBadges = useMemo(() => {
    const badges = data?.badges || [];
    const out = {};
    badges.forEach((badge) => {
      const key = badge.category || 'general';
      if (!out[key]) out[key] = [];
      out[key].push(badge);
    });
    return out;
  }, [data]);

  const downloadCard = () => {
    const url = drawShareCard({ type: shareType, stats: streak, level, rank });
    const a = document.createElement('a');
    a.href = url;
    a.download = `eco-share-${shareType}.png`;
    a.click();
  };

  return (
    <div className="content gami-root">
      {showCelebration ? (
        <div className="celebration-modal">
          <div className="celebration-body">
            <h3>Level Up Celebration</h3>
            <p>You are now {level.levelTitle}. Keep this streak alive.</p>
            <button className="btn" type="button" onClick={() => setShowCelebration(false)}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      <section className="glass-card">
        <h3>Daily Streak</h3>
        <div className="streak-grid">
          <div>
            <strong>{streak.currentStreak || 0}</strong>
            <span>Current</span>
          </div>
          <div>
            <strong>{streak.bestStreak || 0}</strong>
            <span>Best</span>
          </div>
        </div>
        <div className="calendar-row">
          {(streak.streakCalendar || []).slice(-14).map((d) => (
            <span key={d} className="day-chip">{d.slice(5)}</span>
          ))}
        </div>
      </section>

      <section className="glass-card">
        <h3>Rewards & XP</h3>
        <div className="level-line">Level {level.level} - {level.levelTitle}</div>
        <div className="level-track">
          <div className="level-fill" style={{ width: `${level.progressPercent || 0}%` }} />
        </div>
        <p>{level.currentXp || 0} XP total</p>
      </section>

      <section className="glass-card">
        <h3>Badge Showcase</h3>
        {Object.keys(groupedBadges).length === 0 ? <p>No badges yet. Log a commute to start unlocking.</p> : null}
        {Object.entries(groupedBadges).map(([category, list]) => (
          <div key={category} className="badge-group">
            <h4>{category}</h4>
            <div className="badge-grid">
              {list.map((badge) => (
                <article key={badge.id} className="badge-item">
                  <div className="badge-icon">{badge.icon}</div>
                  <div className="badge-title">{badge.title}</div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="glass-card">
        <h3>Habit Nudges</h3>
        {(data?.nudges || ["Don't break your streak today."]).map((nudge) => (
          <p key={nudge}>- {nudge}</p>
        ))}
        <h4>Weekly Summary</h4>
        {(weeklySummary?.highlights || []).map((line) => <p key={line}>{line}</p>)}
      </section>

      <section className="glass-card">
        <h3>Share Card</h3>
        <div className="share-actions">
          {SHARE_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${shareType === item.id ? 'active' : ''}`}
              onClick={() => setShareType(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={downloadCard}>
          Download PNG Card
        </button>
      </section>
    </div>
  );
};

export default GamificationHub;
