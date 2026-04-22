import React, { useEffect, useMemo, useState } from 'react';
import './GamificationHub.css';

const SHARE_TYPES = [
  { id: 'streak', label: 'Streak Card' },
  { id: 'carbon', label: 'Carbon Saved Card' },
  { id: 'leaderboard', label: 'Leaderboard Card' },
  { id: 'level', label: 'Level Card' }
];

const CARD_THEME = {
  forest: '#1a3a2a',
  moss: '#2d5a3d',
  sage: '#4a7c59',
  leaf: '#6aad78',
  gold: '#c9a84c',
  goldLight: '#e8c96a',
  cream: '#f5f0e8',
  white: '#ffffff',
  textDim: 'rgba(245,240,232,0.68)'
};

function formatShortDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function formatCompactNumber(value) {
  const numeric = Number(value) || 0;
  if (Math.abs(numeric) >= 1000) {
    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(numeric);
  }
  return String(Math.round(numeric * 10) / 10);
}

function getShareCardModel({ type, streak, level, rank, userName, profileStats }) {
  const totalCarbonSaved = Number(profileStats?.totalCarbonSaved) || 0;
  const totalPoints = Number(profileStats?.totalPoints) || 0;
  const tripsLogged = Number(profileStats?.weeklyCommutes) || 0;
  const currentStreak = Number(streak?.currentStreak) || 0;
  const bestStreak = Number(streak?.bestStreak) || 0;
  const currentXp = Number(level?.currentXp) || 0;
  const progressPercent = Math.max(1, Number(level?.progressPercent) || 0);
  const nextLevelXp = Number(level?.nextLevelXp) || currentXp || 1;
  const user = userName || 'Eco Commuter';

  const base = {
    userName: user,
    date: formatShortDate(),
    progressPercent,
    progressText: `${currentXp} / ${nextLevelXp} XP`,
    progressLabel: 'Progress to next level'
  };

  const cardByType = {
    streak: {
      variant: 'streak',
      icon: '🔥',
      eyebrow: 'Consistency unlocked',
      titleTop: `${currentStreak} Day`,
      titleAccent: 'Streak',
      badge: `${level.levelTitle} · Daily Rhythm`,
      heroValue: `${currentStreak}`,
      heroUnit: 'days active',
      summary: 'You are building a visible habit, not just logging random trips.',
      stats: [
        { value: currentStreak, label: 'Current' },
        { value: bestStreak, label: 'Best' },
        { value: formatCompactNumber(currentXp), label: 'XP' }
      ],
      ctaTitle: 'Share your momentum',
      ctaBody: 'Consistency is contagious. A streak card makes the habit feel real.',
      ribbon: 'Keep it alive tomorrow',
      orbLabel: 'Current Run'
    },
    carbon: {
      variant: 'carbon',
      icon: '🌍',
      eyebrow: 'Planet-positive impact',
      titleTop: 'Carbon',
      titleAccent: 'Saved',
      badge: `${level.levelTitle} · Climate Impact`,
      heroValue: `${totalCarbonSaved.toFixed(1)}`,
      heroUnit: 'kg CO2 avoided',
      summary: 'This is the environmental value behind your daily transport decisions.',
      stats: [
        { value: `${Math.round(totalCarbonSaved / 21)}`, label: 'Tree Eq.' },
        { value: formatCompactNumber(totalPoints), label: 'Eco Points' },
        { value: formatCompactNumber(tripsLogged), label: 'Trips' }
      ],
      progressText: `${totalCarbonSaved.toFixed(1)} kg lifetime`,
      progressLabel: 'Lifetime impact',
      ctaTitle: 'Let the numbers speak',
      ctaBody: 'This format turns your commute history into a premium climate-impact snapshot.',
      ribbon: 'Impact compounds quietly',
      orbLabel: 'Lifetime Saved'
    },
    leaderboard: {
      variant: 'leaderboard',
      icon: '🏆',
      eyebrow: 'Achievement unlocked',
      titleTop: rank ? `Rank #${rank}` : 'Leaderboard',
      titleAccent: rank ? 'Momentum' : 'Climb',
      badge: rank ? `${level.levelTitle} · Top Performer` : `${level.levelTitle} · Rising Fast`,
      heroValue: rank ? `#${rank}` : '↑',
      heroUnit: rank ? 'current rank' : 'climbing',
      summary: 'A competitive card should feel sharper, faster, and more status-driven.',
      stats: [
        { value: formatCompactNumber(totalPoints), label: 'Points' },
        { value: `${currentStreak}`, label: 'Streak' },
        { value: `${totalCarbonSaved.toFixed(1)}kg`, label: 'CO2 Saved' }
      ],
      ctaTitle: 'Show your rank',
      ctaBody: 'Leaderboard cards are built to spark healthy competition and social proof.',
      ribbon: rank ? `Top ${rank} energy` : 'Ranking in progress',
      orbLabel: rank ? `#${rank}` : 'Board Position'
    },
    level: {
      variant: 'level',
      icon: '✨',
      eyebrow: 'Growth milestone',
      titleTop: level.levelTitle || 'Seedling',
      titleAccent: `Level ${level.level || 1}`,
      badge: `${level.levelTitle} · Growth Mode`,
      heroValue: formatCompactNumber(currentXp),
      heroUnit: 'xp collected',
      summary: 'A level card should feel aspirational and polished, almost like an award certificate.',
      stats: [
        { value: `${level.level || 1}`, label: 'Level' },
        { value: `${currentStreak}`, label: 'Streak' },
        { value: formatCompactNumber(totalPoints), label: 'Points' }
      ],
      ctaTitle: 'Celebrate the climb',
      ctaBody: 'This version puts progression first so the milestone feels earned.',
      ribbon: 'Growth mode active',
      orbLabel: 'XP Bank'
    }
  };

  return { ...base, ...cardByType[type] };
}

function drawBotanical(ctx, variant) {
  ctx.save();
  ctx.globalAlpha = variant === 'carbon' ? 0.12 : 0.08;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = variant === 'leaderboard' ? 3 : 4;

  if (variant === 'leaderboard') {
    ctx.translate(885, 800);
    ctx.beginPath();
    ctx.moveTo(-60, 90);
    ctx.lineTo(-20, -20);
    ctx.lineTo(0, 20);
    ctx.lineTo(28, -70);
    ctx.lineTo(66, 90);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.translate(865, 815);
  ctx.scale(1.15, 1.15);
  ctx.beginPath();
  ctx.moveTo(0, 120);
  ctx.bezierCurveTo(-15, 40, -10, -50, 0, -140);
  ctx.stroke();

  const leaves = [
    { x1: 0, y1: -90, c1x: -55, c1y: -110, c2x: -90, c2y: -70, x2: -100, y2: -20 },
    { x1: 0, y1: -35, c1x: -40, c1y: -60, c2x: -65, c2y: -25, x2: -72, y2: 28 },
    { x1: 0, y1: -110, c1x: 60, c1y: -130, c2x: 95, c2y: -92, x2: 110, y2: -40 },
    { x1: 0, y1: -62, c1x: 44, c1y: -82, c2x: 72, c2y: -48, x2: 78, y2: -6 }
  ];

  leaves.forEach((leaf) => {
    ctx.beginPath();
    ctx.moveTo(leaf.x1, leaf.y1);
    ctx.bezierCurveTo(leaf.c1x, leaf.c1y, leaf.c2x, leaf.c2y, leaf.x2, leaf.y2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawOrnament(ctx, model) {
  ctx.save();
  if (model.variant === 'streak') {
    const ring = ctx.createRadialGradient(845, 360, 20, 845, 360, 120);
    ring.addColorStop(0, 'rgba(201,168,76,0.22)');
    ring.addColorStop(1, 'rgba(201,168,76,0)');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(845, 360, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,201,106,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(845, 360, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = CARD_THEME.goldLight;
    ctx.font = '700 74px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(model.heroValue, 845, 350);
    ctx.fillStyle = CARD_THEME.textDim;
    ctx.font = '500 18px "DM Sans", Arial';
    ctx.fillText(model.orbLabel.toUpperCase(), 845, 394);
  } else if (model.variant === 'carbon') {
    const grad = ctx.createLinearGradient(720, 246, 930, 516);
    grad.addColorStop(0, 'rgba(106,173,120,0.18)');
    grad.addColorStop(1, 'rgba(201,168,76,0.12)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(700, 520);
    ctx.bezierCurveTo(635, 410, 668, 292, 790, 246);
    ctx.bezierCurveTo(875, 210, 960, 256, 988, 346);
    ctx.bezierCurveTo(1010, 422, 956, 508, 850, 534);
    ctx.bezierCurveTo(794, 548, 742, 542, 700, 520);
    ctx.fill();
    ctx.fillStyle = CARD_THEME.cream;
    ctx.font = '700 66px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(model.heroValue, 844, 385);
    ctx.font = '500 20px "DM Sans", Arial';
    ctx.fillStyle = CARD_THEME.textDim;
    ctx.fillText(model.orbLabel.toUpperCase(), 844, 423);
  } else if (model.variant === 'leaderboard') {
    ctx.strokeStyle = 'rgba(201,168,76,0.26)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeRect(720 + i * 28, 262 + i * 28, 186 - i * 56, 300 - i * 56);
    }
    ctx.fillStyle = CARD_THEME.goldLight;
    ctx.font = '700 120px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(model.heroValue, 835, 396);
    ctx.fillStyle = CARD_THEME.textDim;
    ctx.font = '500 18px "DM Sans", Arial';
    ctx.fillText(model.orbLabel.toUpperCase(), 835, 438);
  } else {
    const halo = ctx.createLinearGradient(720, 250, 980, 520);
    halo.addColorStop(0, 'rgba(201,168,76,0.1)');
    halo.addColorStop(0.5, 'rgba(106,173,120,0.18)');
    halo.addColorStop(1, 'rgba(201,168,76,0.08)');
    ctx.fillStyle = halo;
    ctx.fillRect(708, 248, 252, 252);
    ctx.strokeStyle = 'rgba(232,201,106,0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(732, 272, 204, 204);
    ctx.fillStyle = CARD_THEME.cream;
    ctx.font = '700 88px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(model.heroValue, 834, 372);
    ctx.fillStyle = CARD_THEME.textDim;
    ctx.font = '500 18px "DM Sans", Arial';
    ctx.fillText(model.orbLabel.toUpperCase(), 834, 420);
  }
  ctx.restore();
}

function drawSummaryBlock(ctx, model) {
  ctx.save();
  if (model.variant === 'carbon') {
    ctx.fillStyle = 'rgba(245,240,232,0.09)';
    ctx.fillRect(110, 612, 860, 82);
    ctx.fillStyle = CARD_THEME.cream;
    ctx.font = '400 24px "DM Sans", Arial';
    ctx.fillText(model.summary, 140, 662);
  } else if (model.variant === 'leaderboard') {
    ctx.fillStyle = CARD_THEME.gold;
    ctx.fillRect(110, 620, 280, 4);
    ctx.fillStyle = CARD_THEME.cream;
    ctx.font = '400 22px "DM Sans", Arial';
    ctx.fillText(model.summary, 110, 668);
  } else if (model.variant === 'level') {
    ctx.fillStyle = 'rgba(201,168,76,0.1)';
    ctx.beginPath();
    ctx.roundRect(110, 610, 348, 90, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.2)';
    ctx.stroke();
    ctx.fillStyle = CARD_THEME.cream;
    ctx.font = '400 22px "DM Sans", Arial';
    ctx.fillText(model.summary, 138, 661);
  } else {
    ctx.fillStyle = CARD_THEME.cream;
    ctx.font = 'italic 400 26px "Playfair Display", Georgia, serif';
    ctx.fillText(model.summary, 110, 668);
  }
  ctx.restore();
}

function drawStats(ctx, model) {
  ctx.save();
  if (model.variant === 'carbon') {
    model.stats.forEach((stat, index) => {
      const x = 110 + index * 285;
      ctx.fillStyle = 'rgba(245,240,232,0.06)';
      ctx.beginPath();
      ctx.roundRect(x, 728, 255, 98, 16);
      ctx.fill();
      ctx.fillStyle = CARD_THEME.white;
      ctx.font = '700 48px "Playfair Display", Georgia, serif';
      ctx.fillText(String(stat.value), x + 26, 784);
      ctx.fillStyle = CARD_THEME.textDim;
      ctx.font = '500 18px "DM Sans", Arial';
      ctx.fillText(stat.label.toUpperCase(), x + 26, 814);
    });
  } else {
    const statTop = model.variant === 'leaderboard' ? 726 : 720;
    const statWidth = 250;
    model.stats.forEach((stat, index) => {
      const statX = 110 + index * 290;
      ctx.fillStyle = CARD_THEME.white;
      ctx.font = '700 56px "Playfair Display", Georgia, serif';
      ctx.fillText(String(stat.value), statX, statTop);
      ctx.fillStyle = CARD_THEME.textDim;
      ctx.font = '500 18px "DM Sans", Arial';
      ctx.fillText(stat.label.toUpperCase(), statX, statTop + 34);
      if (index < model.stats.length - 1) {
        ctx.fillStyle = 'rgba(201,168,76,0.22)';
        ctx.fillRect(statX + statWidth, statTop - 48, 2, 92);
      }
    });
  }
  ctx.restore();
}

function drawShareCard(model) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
  bgGrad.addColorStop(0, CARD_THEME.forest);
  bgGrad.addColorStop(0.62, model.variant === 'leaderboard' ? '#3d5230' : CARD_THEME.moss);
  bgGrad.addColorStop(1, model.variant === 'level' ? '#17261d' : '#102218');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1080);

  const glow = ctx.createRadialGradient(
    model.variant === 'leaderboard' ? 860 : 220,
    model.variant === 'leaderboard' ? 220 : 180,
    0,
    model.variant === 'leaderboard' ? 860 : 220,
    model.variant === 'leaderboard' ? 220 : 180,
    360
  );
  glow.addColorStop(0, model.variant === 'carbon' ? 'rgba(106,173,120,0.24)' : 'rgba(106,173,120,0.2)');
  glow.addColorStop(1, 'rgba(106,173,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 9000; i += 1) {
    const x = (i * 37) % 1080;
    const y = (i * 67) % 1080;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  drawBotanical(ctx, model.variant);

  ctx.strokeStyle = 'rgba(201,168,76,0.32)';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, 996, 996);
  ctx.strokeStyle = 'rgba(201,168,76,0.26)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(76, 76, 928, 928);

  ctx.strokeStyle = CARD_THEME.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(76, 106);
  ctx.lineTo(106, 106);
  ctx.moveTo(76, 76);
  ctx.lineTo(76, 106);
  ctx.moveTo(1004, 974);
  ctx.lineTo(974, 974);
  ctx.moveTo(1004, 1004);
  ctx.lineTo(1004, 974);
  ctx.stroke();

  const iconGrad = ctx.createLinearGradient(118, 116, 156, 154);
  iconGrad.addColorStop(0, CARD_THEME.leaf);
  iconGrad.addColorStop(1, CARD_THEME.sage);
  ctx.fillStyle = iconGrad;
  ctx.beginPath();
  ctx.arc(138, 136, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 24px "DM Sans", Arial';
  ctx.fillStyle = CARD_THEME.cream;
  ctx.fillText(model.icon, 124, 145);
  ctx.font = '500 24px "DM Sans", Arial';
  ctx.fillStyle = CARD_THEME.textDim;
  ctx.fillText('CARBON TRACKER', 178, 144);

  const divider = ctx.createLinearGradient(110, 0, 255, 0);
  divider.addColorStop(0, CARD_THEME.gold);
  divider.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.fillStyle = divider;
  ctx.fillRect(110, 188, 120, 2);

  ctx.fillStyle = CARD_THEME.gold;
  ctx.font = '500 20px "DM Sans", Arial';
  ctx.fillText(model.eyebrow.toUpperCase(), 110, 230);

  ctx.fillStyle = CARD_THEME.cream;
  ctx.font = '700 82px "Playfair Display", Georgia, serif';
  ctx.fillText(model.titleTop, 110, 330);
  ctx.fillStyle = CARD_THEME.goldLight;
  ctx.font = 'italic 700 82px "Playfair Display", Georgia, serif';
  ctx.fillText(model.titleAccent, 110, 414);

  ctx.fillStyle = CARD_THEME.leaf;
  ctx.font = 'italic 42px "Playfair Display", Georgia, serif';
  ctx.fillText(model.userName, 110, 478);

  ctx.fillStyle = 'rgba(201,168,76,0.12)';
  ctx.strokeStyle = 'rgba(201,168,76,0.34)';
  ctx.lineWidth = 1.5;
  const pillX = 110;
  const pillY = 518;
  const pillW = Math.min(620, 60 + model.badge.length * 15);
  const pillH = 46;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 23);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CARD_THEME.gold;
  ctx.beginPath();
  ctx.arc(pillX + 24, pillY + 23, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '500 20px "DM Sans", Arial';
  ctx.fillText(model.badge.toUpperCase(), pillX + 42, pillY + 29);

  ctx.fillStyle = CARD_THEME.textDim;
  ctx.font = '500 18px "DM Sans", Arial';
  ctx.fillText(model.ribbon.toUpperCase(), 110, 602);

  drawOrnament(ctx, model);
  drawSummaryBlock(ctx, model);
  drawStats(ctx, model);

  ctx.fillStyle = CARD_THEME.textDim;
  ctx.font = '500 18px "DM Sans", Arial';
  ctx.textAlign = 'left';
  ctx.fillText(model.progressLabel.toUpperCase(), 110, 892);
  ctx.textAlign = 'right';
  ctx.fillText(model.progressText.toUpperCase(), 970, 892);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(110, 910, 860, 10, 5);
  ctx.fill();

  const fillGrad = ctx.createLinearGradient(110, 0, 970, 0);
  fillGrad.addColorStop(0, CARD_THEME.sage);
  fillGrad.addColorStop(1, CARD_THEME.gold);
  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.roundRect(110, 910, (860 * model.progressPercent) / 100, 10, 5);
  ctx.fill();

  ctx.strokeStyle = 'rgba(201,168,76,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(110, 960);
  ctx.lineTo(970, 960);
  ctx.stroke();

  ctx.fillStyle = CARD_THEME.gold;
  ctx.font = '700 20px "DM Sans", Arial';
  ctx.textAlign = 'left';
  ctx.fillText(model.ctaTitle, 110, 1002);
  ctx.fillStyle = CARD_THEME.cream;
  ctx.font = '400 24px "DM Sans", Arial';
  ctx.fillText(model.ctaBody, 110, 1038);

  ctx.fillStyle = CARD_THEME.textDim;
  ctx.font = '500 18px "DM Sans", Arial';
  ctx.textAlign = 'right';
  ctx.fillText(model.date.toUpperCase(), 970, 1038);

  return canvas.toDataURL('image/png');
}

const GamificationHub = ({ data, weeklySummary, userName, profileStats }) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [shareType, setShareType] = useState('streak');
  const streak = useMemo(() => data?.streak || {}, [data]);
  const rewards = useMemo(() => data?.rewards || {}, [data]);
  const level = useMemo(
    () =>
      rewards.level || {
        level: 1,
        levelTitle: 'Seedling',
        progressPercent: 0,
        currentXp: 0,
        nextLevelXp: 300
      },
    [rewards]
  );
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

  const latestBadgeKey = useMemo(() => {
    const badges = data?.badges || [];
    if (!badges.length) return null;
    const latestBadge = [...badges].sort((a, b) => {
      const aTime = new Date(a.unlockedAt || 0).getTime();
      const bTime = new Date(b.unlockedAt || 0).getTime();
      return bTime - aTime;
    })[0];
    if (!latestBadge?.id) return null;
    return `${latestBadge.id}:${latestBadge.unlockedAt || 'unknown'}`;
  }, [data]);

  useEffect(() => {
    if (!latestBadgeKey) {
      setShowCelebration(false);
      return;
    }
    const storageKey = 'carbonGamified:lastCelebratedBadge';
    const seenBadgeKey = window.sessionStorage.getItem(storageKey);
    if (seenBadgeKey === latestBadgeKey) {
      setShowCelebration(false);
      return;
    }
    window.sessionStorage.setItem(storageKey, latestBadgeKey);
    setShowCelebration(true);
  }, [latestBadgeKey]);

  const shareCard = useMemo(
    () =>
      getShareCardModel({
        type: shareType,
        streak,
        level,
        rank,
        userName,
        profileStats
      }),
    [shareType, streak, level, rank, userName, profileStats]
  );

  const downloadCard = () => {
    const url = drawShareCard(shareCard);
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
            <span key={d} className="day-chip">
              {d.slice(5)}
            </span>
          ))}
        </div>
      </section>

      <section className="glass-card">
        <h3>Rewards & XP</h3>
        <div className="level-line">
          Level {level.level} - {level.levelTitle}
        </div>
        <div className="level-track">
          <div className="level-fill" style={{ width: `${level.progressPercent || 0}%` }} />
        </div>
        <p>{level.currentXp || 0} XP total</p>
      </section>

      <section className="glass-card">
        <h3>Badge Showcase</h3>
        {Object.keys(groupedBadges).length === 0 ? (
          <p>No badges yet. Log a commute to start unlocking.</p>
        ) : null}
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
        {(weeklySummary?.highlights || []).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>

      <section className="glass-card share-card-shell">
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

        <div className={`share-card-preview share-card-preview--${shareCard.variant}`}>
          <div className="share-card-glow" />
          <div className="share-card-botanical" aria-hidden="true" />
          <div className="share-card-frame" />

          <div className="share-card-inner">
            <div className="share-card-brand">
              <div className="share-brand-icon">{shareCard.icon}</div>
              <span className="share-brand-name">Carbon Tracker</span>
            </div>

            <div className="share-divider" />

            <div className="share-achievement-label">{shareCard.eyebrow}</div>
            <div className="share-headline">
              <span>{shareCard.titleTop}</span>
              <em>{shareCard.titleAccent}</em>
            </div>
            <div className="share-username">{shareCard.userName}</div>

            <div className="share-level-badge">
              <div className="share-badge-dot" />
              <span>{shareCard.badge}</span>
            </div>

            <div className="share-card-ribbon">{shareCard.ribbon}</div>

            <div className={`share-hero-panel share-hero-panel--${shareCard.variant}`}>
              <div className="share-hero-copy">
                <div className="share-hero-value">{shareCard.heroValue}</div>
                <div className="share-hero-unit">{shareCard.heroUnit}</div>
              </div>
              <div className="share-hero-mark">{shareCard.orbLabel}</div>
            </div>

            <div className={`share-summary-block share-summary-block--${shareCard.variant}`}>
              {shareCard.summary}
            </div>

            <div className={`share-stats-row share-stats-row--${shareCard.variant}`}>
              {shareCard.stats.map((stat, index) => (
                <React.Fragment key={`${stat.label}-${index}`}>
                  <div className="share-stat-item">
                    <span className="share-stat-value">{stat.value}</span>
                    <span className="share-stat-label">{stat.label}</span>
                  </div>
                  {index < shareCard.stats.length - 1 ? <div className="share-stat-sep" /> : null}
                </React.Fragment>
              ))}
            </div>

            <div className="share-card-spacer" />

            <div className="share-xp-bar-wrap">
              <div className="share-xp-bar-top">
                <span>{shareCard.progressLabel}</span>
                <span>{shareCard.progressText}</span>
              </div>
              <div className="share-xp-bar-bg">
                <div className="share-xp-bar-fill" style={{ width: `${shareCard.progressPercent}%` }} />
              </div>
            </div>

            <div className="share-card-bottom">
              <div className="share-card-cta">
                <strong>{shareCard.ctaTitle}</strong>
                <span>{shareCard.ctaBody}</span>
              </div>
              <div className="share-card-date">{shareCard.date}</div>
            </div>
          </div>
        </div>

        <button type="button" className="btn share-download-btn" onClick={downloadCard}>
          Download PNG Card
        </button>
      </section>
    </div>
  );
};

export default GamificationHub;
