import React, { useCallback, useState } from 'react';
import api from '../api/client';
import MapComponent from './MapComponent';
import TripTracker from './TripTracker';
import './CommuteLogger.css';

const CommuteLogger = ({ user, onCommuteLogged }) => {
  const [transportMode, setTransportMode] = useState('');
  const [distance, setDistance] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [useMap, setUseMap] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [useTracking, setUseTracking] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const transportOptions = [
    { id: 'car', name: 'Car', emoji: '🚗', carbonFactor: 192 },
    { id: 'motorcycle', name: 'Motorcycle', emoji: '🏍️', carbonFactor: 84 },
    { id: 'bus', name: 'Bus', emoji: '🚌', carbonFactor: 89 },
    { id: 'train', name: 'Train', emoji: '🚆', carbonFactor: 34 },
    { id: 'bicycle', name: 'Bicycle', emoji: '🚴', carbonFactor: 0 },
    { id: 'walking', name: 'Walking', emoji: '🚶', carbonFactor: 0 }
  ];

  const handleRouteCalculated = useCallback((routeInfo) => {
    if (!routeInfo || !routeInfo.distance || routeInfo.distance <= 0) {
      setRouteData(null);
      setDistance('');
      return;
    }
    setRouteData(routeInfo);
    setDistance(String(routeInfo.distance));
  }, []);

  const handleTripComplete = useCallback(async (tripData) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/api/commute/tracked', {
        transportMode: tripData.transportMode,
        distance: tripData.distance,
        duration: tripData.duration,
        averageSpeed: tripData.averageSpeed,
        path: tripData.path,
        startTime: tripData.startTime,
        endTime: tripData.endTime
      });

      if (response.data.success) {
        setResult(response.data);
        onCommuteLogged(response.data, transportMode, tripData.distance);
        setIsTracking(false);
        setUseTracking(false);
        setTransportMode('');
        setDistance('');
        setRouteData(null);
      } else {
        setError(response.data.message || 'Failed to log tracked commute');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [transportMode, onCommuteLogged]);

  const handleTripCancel = useCallback(() => {
    setIsTracking(false);
    setUseTracking(false);
    setError('Trip tracking cancelled');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    const finalDistance = useMap && routeData ? routeData.distance : parseFloat(String(distance));

    if (!transportMode || !finalDistance || finalDistance <= 0) {
      setError('Please select transport mode and enter a valid distance');
      setLoading(false);
      return;
    }
    if (useMap && !routeData?.routeToken) {
      setError('Map validation requires a verified route. Please recalculate route and try again.');
      setLoading(false);
      return;
    }

    try {
      const endpoint = useMap ? '/api/commute/routed' : '/api/commute';
      const payload = useMap
        ? {
            transportMode,
            distance: finalDistance,
            route: routeData?.route,
            startPoint: routeData?.startPoint,
            endPoint: routeData?.endPoint,
            routeToken: routeData?.routeToken
          }
        : {
            transportMode,
            distance: finalDistance
          };
      const response = await api.post(endpoint, payload);

      if (response.data.success) {
        setResult(response.data);
        onCommuteLogged(response.data, transportMode, finalDistance);
        setTransportMode('');
        setDistance('');
        setRouteData(null);
      } else {
        setError(response.data.message || 'Failed to log commute');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => num.toLocaleString();

  return (
    <div className="content commute-logger">
      <div className="method-guide-card" role="note" aria-label="Choose one commute logging method">
        <div className="method-guide-header">
          <h3>🚲 Choose the Best Way to Log Your Commute</h3>
          <p>Use whichever method fits your trip best — you are always in control.</p>
        </div>

        <div className="method-guide-grid">
          <article className="method-guide-item">
            <div className="method-guide-icon" aria-hidden="true">✍️</div>
            <div>
              <h4>1. Manual Entry</h4>
              <p className="method-guide-copy">
                Best for regular routes like home-college, home-office, and school-home.
                If you already know the distance, enter it directly.
              </p>
            </div>
          </article>

          <article className="method-guide-item">
            <div className="method-guide-icon" aria-hidden="true">🗺️</div>
            <div>
              <h4>2. Maps Route</h4>
              <p className="method-guide-copy">
                Best for intercity travel, new destinations, or one-time trips.
                Pick From and To locations and route distance is calculated for you.
              </p>
            </div>
          </article>

          <article className="method-guide-item">
            <div className="method-guide-icon" aria-hidden="true">📍</div>
            <div>
              <h4>3. GPS Live Tracking</h4>
              <p className="method-guide-copy">
                Best for real-time trips, daily commute challenges, and extra rewards.
                Just start tracking and the app auto-calculates your distance.
              </p>
            </div>
          </article>
        </div>

        <p className="method-guide-footer">
          Choose any one method below to continue. You are always in control of how you log your commute.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="commute-form">
        <div className="section-title">Transport mode</div>
        <div className="transport-grid">
          {transportOptions.map((option) => (
            <label
              key={option.id}
              className={`transport-card ${transportMode === option.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="transportMode"
                value={option.id}
                checked={transportMode === option.id}
                onChange={(e) => setTransportMode(e.target.value)}
              />
              <span className="transport-icon">{option.emoji}</span>
              <span className="transport-name">{option.name}</span>
              <span className="transport-co2">
                {option.carbonFactor > 0 ? `${option.carbonFactor}g CO₂/km` : '0g CO₂/km'}
              </span>
            </label>
          ))}
        </div>

        <div className="section-title">Validation method</div>
        <div className="input-section">
          <button
            type="button"
            className={`input-button ${!useTracking ? 'active' : ''}`}
            onClick={() => {
              setUseTracking(false);
              setIsTracking(false);
              setRouteData(null);
              setDistance('');
            }}
          >
            Manual entry
          </button>
          <button
            type="button"
            className={`input-button ${useTracking ? 'active' : ''}`}
            onClick={() => {
              if (!transportMode) {
                setError('Please select transport mode first');
                return;
              }
              setUseTracking(true);
              setIsTracking(true);
              setUseMap(false);
              setRouteData(null);
              setDistance('');
            }}
          >
            📍 Live GPS tracking
          </button>
          <button
            type="button"
            className={`input-button ${useMap ? 'active' : ''}`}
            onClick={() => {
              setUseMap(true);
              setUseTracking(false);
              setIsTracking(false);
              setDistance('');
            }}
          >
            🗺️ Map route
          </button>
        </div>

        {useTracking ? (
          <TripTracker
            transportMode={transportMode}
            isTracking={isTracking}
            setUseTracking={setUseTracking}
            setIsTracking={setIsTracking}
            onTripComplete={handleTripComplete}
            onTripCancel={handleTripCancel}
          />
        ) : !useMap ? (
          <div className="form-group manual-distance">
            <label className="form-label" htmlFor="distance-km">
              Distance (km)
            </label>
            <input
              id="distance-km"
              type="number"
              step="0.1"
              min="0.1"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="input"
              placeholder="Enter distance in kilometers"
              required={!useMap}
            />
          </div>
        ) : (
          <div className="map-section">
            <div className="section-title">Route on map</div>
            <MapComponent onRouteCalculated={handleRouteCalculated} transportMode={transportMode} />
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <button
          type="submit"
          className="btn submit-btn"
          disabled={loading || (useMap && (!routeData || !routeData.distance || !routeData.routeToken))}
        >
          {loading ? 'Logging…' : 'Log commute'}
        </button>
      </form>

      {result && (
        <div className="result-card">
          <h3>Commute logged</h3>
          <div className="result-stats">
            <div className="result-item">
              <span className="result-label">CO₂ saved vs car</span>
              <span className="result-value success">
                {formatNumber(result.carbonSavedVsCar.toFixed(1))} kg
              </span>
            </div>
            <div className="result-item">
              <span className="result-label">Points earned</span>
              <span className="result-value points">+{formatNumber(result.pointsEarned)}</span>
            </div>
            <div className="result-item">
              <span className="result-label">New total points</span>
              <span className="result-value total">{formatNumber(result.newTotalPoints)}</span>
            </div>
            {result.validationScore ? (
              <div className="result-item">
                <span className="result-label">Validation score</span>
                <span className="result-value">{result.validationScore}/100</span>
              </div>
            ) : null}
            {result.bonusMultiplier > 1 ? (
              <div className="result-item">
                <span className="result-label">Validation bonus</span>
                <span className="result-value success">
                  +{Math.round((result.bonusMultiplier - 1) * 100)}%
                </span>
              </div>
            ) : null}
          </div>
          <p className="result-foot">Nice work — keep choosing lower-carbon options.</p>
        </div>
      )}
    </div>
  );
};

export default CommuteLogger;
