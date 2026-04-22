import React from 'react';
import './TripDetails.css';

const TripDetails = ({ tripData, onBack, transportMode, distance, userStats, onNavigateToLeaderboard, onLogAnotherTrip }) => {
  const formatNumber = (num) => num.toLocaleString();

  const handleLeaderboardClick = () => {
    console.log('Leaderboard button clicked');
    if (onNavigateToLeaderboard) {
      onNavigateToLeaderboard();
    } else {
      console.error('onNavigateToLeaderboard function not provided');
    }
  };

  const handleLogAnotherTrip = () => {
    console.log('Log another trip button clicked');
    if (onLogAnotherTrip) {
      onLogAnotherTrip();
    } else {
      console.error('onLogAnotherTrip function not provided');
    }
  };

  const getTransportEmoji = (mode) => {
    const emojis = {
      car: '🚗',
      motorcycle: '🏍️',
      bus: '🚌',
      train: '🚆',
      bicycle: '🚴',
      walking: '🚶'
    };
    return emojis[mode] || '🚗';
  };

  const getTransportName = (mode) => {
    const names = {
      car: 'Car',
      motorcycle: 'Motorcycle',
      bus: 'Bus',
      train: 'Train',
      bicycle: 'Bicycle',
      walking: 'Walking'
    };
    return names[mode] || 'Car';
  };

  const calculateEnvironmentalImpact = (carbonSaved) => {
    const treesEquivalent = carbonSaved / 21; // 21 kg CO2 per tree per year
    const carHoursOffRoad = carbonSaved / 0.192; // 192g CO2 per km for average car
    const lightBulbHours = (carbonSaved * 1000) / 0.011; // 11g CO2 per hour for LED bulb
    
    return {
      treesEquivalent,
      carHoursOffRoad,
      lightBulbHours
    };
  };

  const impact = calculateEnvironmentalImpact(tripData.carbonSavedVsCar);

  return (
    <div className="trip-details">
      <div className="trip-header">
        <button type="button" className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h2>Your Trip Impact</h2>
      </div>

      <div className="trip-summary-card">
        <div className="trip-main-info">
          <div className="trip-transport">
            <span className="transport-emoji">{getTransportEmoji(transportMode)}</span>
            <span className="transport-name">{getTransportName(transportMode)}</span>
          </div>
          <div className="trip-distance">
            <span className="distance-value">{formatNumber(distance)}</span>
            <span className="distance-unit">kilometers</span>
          </div>
        </div>
      </div>

      <div className="impact-grid">
        <div className="impact-card primary">
          <h3>Carbon Saved</h3>
          <div className="impact-value">
            {formatNumber(tripData.carbonSavedVsCar.toFixed(1))} kg CO²
          </div>
          <p>Compared to driving the same distance</p>
        </div>

        <div className="impact-card success">
          <h3>Points Earned</h3>
          <div className="impact-value">
            +{formatNumber(tripData.pointsEarned)}
          </div>
          <p>{tripData.bonusMultiplier > 1 ? 
            `Includes ${Math.round((tripData.bonusMultiplier - 1) * 100)}% validation bonus!` : 
            'Eco points added to your total'}</p>
        </div>

        <div className="impact-card info">
          <h3>Your Emissions</h3>
          <div className="impact-value">
            {formatNumber(tripData.carbonEmitted.toFixed(1))} kg CO²
          </div>
          <p>For this specific trip</p>
        </div>
      </div>

      {tripData.validationScore && (
        <div className="validation-section">
          <h3>Trip Validation</h3>
          <div className="validation-score">
            <div className="score-circle">
              <div className="score-value">{tripData.validationScore}</div>
              <div className="score-label">Validation Score</div>
            </div>
            <div className="score-details">
              <p>
                {tripData.validationScore >= 80 ? 
                  'Excellent! Your trip was thoroughly validated with high GPS accuracy.' :
                  tripData.validationScore >= 60 ? 
                  'Good! Your trip passed basic validation checks.' :
                  'Basic validation completed. Consider enabling GPS tracking for higher scores.'}
              </p>
              {tripData.validationMethod === 'gps_tracked' && (
                <p className="validation-method">
                  <span className="method-badge">GPS Tracked</span>
                  Real-time location tracking with speed and route validation
                </p>
              )}
              {tripData.validationMethod === 'manual' && (
                <p className="validation-method">
                  <span className="method-badge manual">Manual Entry</span>
                  Self-reported distance. Enable GPS tracking for validation bonuses.
                </p>
              )}
              {tripData.validationMethod === 'map_route' && (
                <p className="validation-method">
                  <span className="method-badge">Map Route</span>
                  Route-planned validation with moderate confidence and bonus points.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="environmental-impact">
        <h3>Environmental Benefits</h3>
        <div className="benefits-grid">
          <div className="benefit-item">
            <div className="benefit-icon">🌳</div>
            <div className="benefit-content">
              <h4>Trees Equivalent</h4>
              <p>This trip's carbon savings are equivalent to {formatNumber(impact.treesEquivalent.toFixed(2))} trees absorbing CO₂ for a year.</p>
            </div>
          </div>

          <div className="benefit-item">
            <div className="benefit-icon">🚗</div>
            <div className="benefit-content">
              <h4>Car Hours Off Road</h4>
              <p>You saved emissions equivalent to taking a car off the road for {formatNumber(impact.carHoursOffRoad.toFixed(1))} hours.</p>
            </div>
          </div>

          <div className="benefit-item">
            <div className="benefit-icon">💡</div>
            <div className="benefit-content">
              <h4>Energy Savings</h4>
              <p>Your carbon savings could power an LED bulb for {formatNumber(impact.lightBulbHours.toFixed(0))} hours.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="trip-stats">
        <h3>Your Updated Stats</h3>
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-label">Total Points</span>
            <span className="stat-value">{formatNumber(tripData.newTotalPoints)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Lifetime CO₂ Saved</span>
            <span className="stat-value">{formatNumber((userStats?.totalCarbonSaved || 0).toFixed(1))} kg</span>
          </div>
        </div>
      </div>

      <div className="encouragement">
        <h3>Great Choice! 🌍</h3>
        <p>
          By choosing {getTransportName(transportMode).toLowerCase()}, you've made a positive impact on the environment. 
          Every eco-friendly trip contributes to a healthier planet. Keep up the great work!
        </p>
      </div>

      <div className="action-buttons">
        <button type="button" className="primary-btn" onClick={onBack}>
          Continue to Dashboard
        </button>
        <button 
          type="button" 
          className="secondary-btn"
          onClick={handleLogAnotherTrip}
        >
          Log Another Trip
        </button>
        <button 
          type="button" 
          className="tertiary-btn"
          onClick={handleLeaderboardClick}
        >
          View Leaderboard
        </button>
      </div>
    </div>
  );
};

export default TripDetails;
