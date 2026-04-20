import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TripTracker.css';

const TripTracker = ({ 
  transportMode, 
  onTripComplete, 
  onTripCancel,
  isTracking = false,
  setUseTracking,
  setIsTracking
}) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [trackingPath, setTrackingPath] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [averageSpeed, setAverageSpeed] = useState(0);
  const [trackingError, setTrackingError] = useState('');
  const [watchId, setWatchId] = useState(null);
  const [locationPermission, setLocationPermission] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isHttps, setIsHttps] = useState(true);
  const intervalRef = useRef(null);

  // Speed limits for different transport modes (km/h)
  const SPEED_LIMITS = {
    walking: { min: 2, max: 8 },
    bicycle: { min: 8, max: 30 },
    motorcycle: { min: 20, max: 120 },
    car: { min: 15, max: 140 },
    bus: { min: 15, max: 80 },
    train: { min: 30, max: 160 }
  };

  const calculateDistance = useCallback((point1, point2) => {
    if (!point1 || !point2) return 0;
    
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.latitude * Math.PI) / 180) *
        Math.cos((point2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const validateSpeed = useCallback((speed, mode) => {
    const limits = SPEED_LIMITS[mode] || SPEED_LIMITS.car;
    return speed >= limits.min && speed <= limits.max;
  }, [SPEED_LIMITS]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setTrackingError('GPS is not supported by your device. Please use manual entry or map route instead.');
      return;
    }

    setTrackingError('');
    setStartTime(Date.now());
    setTrackingPath([]);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
          speed: position.coords.speed || 0
        };

        setCurrentLocation(newPoint);
        
        setTrackingPath(prev => {
          const newPath = [...prev, newPoint];
          
          // Calculate distance and speed
          if (newPath.length > 1) {
            const lastPoint = newPath[newPath.length - 2];
            const segmentDistance = calculateDistance(lastPoint, newPoint);
            const timeDiff = (newPoint.timestamp - lastPoint.timestamp) / 1000; // seconds
            const speed = timeDiff > 0 ? (segmentDistance / timeDiff) * 3600 : 0; // km/h

            // Validate speed
            if (!validateSpeed(speed, transportMode)) {
              setTrackingError(`Speed ${speed.toFixed(1)} km/h is unrealistic for ${transportMode}`);
              return prev; // Don't add this point
            }

            setDistance(prevDistance => prevDistance + segmentDistance);
            setAverageSpeed(speed);
          }

          return newPath;
        });
      },
      (error) => {
        let errorMessage = 'GPS Error: ';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'GPS permission denied. Please enable location access in your browser settings and refresh the page to try again.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'GPS position unavailable. Please check your device location settings.';
            break;
          case error.TIMEOUT:
            errorMessage = 'GPS request timed out. Please try again with a better GPS signal.';
            break;
          default:
            errorMessage = `GPS Error: ${error.message}`;
        }
        
        setTrackingError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    setWatchId(watchId);

    // Update elapsed time
    intervalRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }, [transportMode, calculateDistance, validateSpeed, startTime]);

  const calculateValidationScore = useCallback(() => {
    let score = 100;
    
    // Deduct points for GPS accuracy issues
    const avgAccuracy = trackingPath.reduce((sum, point) => sum + point.accuracy, 0) / trackingPath.length;
    if (avgAccuracy > 20) score -= 20;
    else if (avgAccuracy > 10) score -= 10;

    // Deduct points for inconsistent speed
    const speeds = [];
    for (let i = 1; i < trackingPath.length; i++) {
      const timeDiff = (trackingPath[i].timestamp - trackingPath[i-1].timestamp) / 1000;
      if (timeDiff > 0) {
        const segmentDistance = calculateDistance(trackingPath[i-1], trackingPath[i]);
        speeds.push((segmentDistance / timeDiff) * 3600);
      }
    }
    
    const speedVariance = speeds.length > 0 ? 
      Math.max(...speeds) - Math.min(...speeds) : 0;
    if (speedVariance > 30) score -= 15;

    return Math.max(0, score);
  }, [trackingPath, calculateDistance]);

  const stopTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (trackingPath.length > 1) {
      const tripData = {
        transportMode,
        distance: distance,
        duration: elapsedTime,
        averageSpeed: averageSpeed,
        path: trackingPath,
        startTime: startTime,
        endTime: Date.now(),
        validationScore: calculateValidationScore()
      };

      onTripComplete(tripData);
    } else {
      setTrackingError('Trip too short to validate. Please try again.');
    }
  }, [watchId, trackingPath, distance, elapsedTime, averageSpeed, transportMode, startTime, onTripComplete, calculateValidationScore]);

  const cancelTracking = useCallback(() => {
    stopTracking();
    onTripCancel();
  }, [stopTracking, onTripCancel]);

  useEffect(() => {
    // Check if we're on HTTPS
    setIsHttps(window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    
    // Check location permission status when component mounts
    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state);
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setLocationPermission(result.state);
        });
      }).catch(() => {
        // Fallback if permissions API is not supported
        setLocationPermission('prompt');
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [watchId]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  if (!isTracking) {
    return null;
  }

  // Show permission prompt if permission is not granted
  if (locationPermission === 'prompt' || locationPermission === 'denied') {
    return (
      <div className="trip-tracker">
        <div className="tracker-header">
          <h3>{getTransportEmoji(transportMode)} {transportMode.charAt(0).toUpperCase() + transportMode.slice(1)} Trip</h3>
        </div>
        
        <div className="permission-prompt">
          <div className="permission-icon">{'\ud83d\udccd'}</div>
          <div className="permission-content">
            <h4>Enable Location Access</h4>
            <p>
              {locationPermission === 'denied' ? 
                'Location access was denied. No problem! You can still log your trip using manual entry.' :
                'GPS tracking requires location access to validate your trip and provide the highest points.'}
            </p>
            {!isHttps && (
              <div className="https-warning">
                <h5>Browser Security Notice</h5>
                <p>
                  Some browsers require HTTPS for location access. If the permission prompt doesn't appear, try using Chrome or Firefox, or use manual entry.
                </p>
              </div>
            )}
            {locationPermission === 'denied' ? (
              <div className="manual-entry-benefits">
                <h5>Manual Entry Still Works Great:</h5>
                <ul>
                  <li>Full points for your eco-friendly choice</li>
                  <li>Quick and easy - no GPS required</li>
                  <li>Still contributes to your carbon savings</li>
                  <li>Helps the environment while protecting privacy</li>
                </ul>
              </div>
            ) : (
              <div className="permission-benefits">
                <h5>Benefits of enabling GPS:</h5>
                <ul>
                  <li>50% bonus points for validated trips</li>
                  <li>Real-time trip tracking</li>
                  <li>Automatic distance calculation</li>
                  <li>Highest validation score (80-100)</li>
                </ul>
              </div>
            )}
            <div className="permission-actions">
              {locationPermission === 'denied' ? (
                <>
                  <button 
                    type="button" 
                    className="btn fallback-btn"
                    onClick={() => {
                      setIsTracking(false);
                      setUseTracking(false);
                    }}
                  >
                    Use Manual Entry
                  </button>
                  <button 
                    type="button" 
                    className="btn retry-btn"
                    onClick={() => {
                      console.log('Requesting location permission...');
                      // Try to request permission again
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            console.log('Location permission granted:', position);
                            setLocationPermission('granted');
                          },
                          (error) => {
                            console.log('Location permission denied:', error);
                            setLocationPermission('denied');
                          },
                          {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0
                          }
                        );
                      } else {
                        console.log('Geolocation not supported');
                      }
                    }}
                  >
                    Retry Location Access
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn fallback-btn"
                    onClick={() => {
                      setIsTracking(false);
                      setUseTracking(false);
                    }}
                  >
                    Use Manual Entry
                  </button>
                  <button 
                    type="button" 
                    className="btn primary-btn"
                    onClick={() => {
                      console.log('Requesting location permission...');
                      // Request location permission with immediate prompt
                      if (navigator.geolocation) {
                        // First try to get current position to trigger permission prompt
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            console.log('Location permission granted:', position);
                            setLocationPermission('granted');
                            // Force a re-render to show the tracking interface
                            setTimeout(() => {
                              // This will cause the component to re-render with granted permission
                            }, 100);
                          },
                          (error) => {
                            console.log('Location permission denied:', error);
                            setLocationPermission('denied');
                          },
                          {
                            enableHighAccuracy: true,
                            timeout: 15000,
                            maximumAge: 0
                          }
                        );
                      } else {
                        console.log('Geolocation not supported');
                        alert('GPS is not supported by your browser. Please use manual entry.');
                      }
                    }}
                  >
                    Enable GPS Tracking
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-tracker">
      <div className="tracker-header">
        <h3>{getTransportEmoji(transportMode)} {transportMode.charAt(0).toUpperCase() + transportMode.slice(1)} Trip</h3>
        <div className="tracker-status">
          <span className={`status-indicator ${trackingPath.length > 0 ? 'active' : 'waiting'}`}>
            {trackingPath.length > 0 ? 'Tracking' : 'Waiting for GPS'}
          </span>
        </div>
      </div>

      <div className="tracker-stats">
        <div className="stat-item">
          <span className="stat-label">Time</span>
          <span className="stat-value">{formatTime(elapsedTime)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Distance</span>
          <span className="stat-value">{distance.toFixed(2)} km</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Speed</span>
          <span className="stat-value">{averageSpeed.toFixed(1)} km/h</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Points</span>
          <span className="stat-value">{trackingPath.length}</span>
        </div>
      </div>

      {currentLocation && (
        <div className="location-info">
          <span className="location-label">Current Location:</span>
          <span className="location-coords">
            {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
          </span>
          <span className="location-accuracy">
            ±{currentLocation.accuracy.toFixed(0)}m
          </span>
        </div>
      )}

      {trackingError && (
        <div className="tracker-error">
          <p>{trackingError}</p>
          {trackingError.includes('permission denied') && (
            <div className="gps-help">
              <h4>How to enable GPS:</h4>
              <ul>
                <li>Click the location icon (lock/globe) in your browser's address bar</li>
                <li>Change "Location" setting to "Allow"</li>
                <li>Refresh the page and try again</li>
              </ul>
              <button 
                type="button" 
                className="btn fallback-btn"
                onClick={() => {
                  setIsTracking(false);
                  setUseTracking(false);
                }}
              >
                Use Manual Entry Instead
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tracker-controls">
        {!watchId ? (
          <button 
            type="button" 
            className="btn start-btn"
            onClick={startTracking}
          >
            Start Tracking
          </button>
        ) : (
          <>
            <button 
              type="button" 
              className="btn stop-btn"
              onClick={stopTracking}
              disabled={trackingPath.length < 2}
            >
              End Trip
            </button>
            <button 
              type="button" 
              className="btn cancel-btn"
              onClick={cancelTracking}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {trackingPath.length > 1 && (
        <div className="tracking-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${Math.min(100, (trackingPath.length / 10) * 100)}%` }}
            />
          </div>
          <span className="progress-text">
            {trackingPath.length} GPS points recorded
          </span>
        </div>
      )}
    </div>
  );
};

export default TripTracker;
