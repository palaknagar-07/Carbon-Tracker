import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import api from '../api/client';
import 'leaflet/dist/leaflet.css';
import './MapComponent.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

const ROUTE_COLOR = '#2d6a4f';

/** Approximate geographic center of India — default map view */
export const INDIA_CENTER = [22.5937, 78.9629];
const INDIA_ZOOM_OVERVIEW = 5;
const INDIA_MAX_BOUNDS = [
  [6.2, 68.0],
  [37.8, 97.8]
];

const NOMINATIM_DELAY_MS = 1100;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeIndia(query) {
  const q = String(query || '').trim();
  if (!q) return null;

  const email =
    process.env.REACT_APP_NOMINATIM_EMAIL || process.env.REACT_APP_CONTACT_EMAIL || '';

  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q,
      format: 'json',
      limit: 1,
      countrycodes: 'in',
      addressdetails: 0,
      ...(email ? { email } : {})
    },
    headers: {
      'Accept-Language': 'en'
    },
    timeout: 15000
  });

  if (!Array.isArray(data) || !data.length) return null;
  const hit = data[0];
  const lat = parseFloat(hit.lat);
  const lon = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

function FitRouteBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions || positions.length < 2) return;
    const latLngs = positions.map((p) => L.latLng(p[0], p[1]));
    const b = L.latLngBounds(latLngs);
    map.fitBounds(b, { padding: [28, 28], maxZoom: 14, animate: true });
  }, [positions, map]);
  return null;
}

const MapComponent = ({ onRouteCalculated, transportMode }) => {
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [route, setRoute] = useState(null);
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [addressError, setAddressError] = useState('');
  const mapRef = useRef();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
      },
      () => {}
    );
  }, []);

  const calculateStraightLineDistance = useCallback((point1, point2) => {
    const R = 6371;
    const dLat = ((point2[0] - point1[0]) * Math.PI) / 180;
    const dLon = ((point2[1] - point1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1[0] * Math.PI) / 180) *
        Math.cos((point2[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const getTransportProfile = useCallback((mode) => {
    const profiles = {
      car: 'driving-car',
      motorcycle: 'driving-car',
      bus: 'driving-car',
      train: 'driving-car',
      bicycle: 'cycling-regular',
      walking: 'foot-walking'
    };
    return profiles[mode] || 'driving-car';
  }, []);

  const calculateRouteBetween = useCallback(
    async (start, end) => {
      if (!start || !end) return;

      setLoading(true);
      setAddressError('');
      try {
        if (!transportMode) {
          const straightLineDistance = calculateStraightLineDistance(start, end);
          setStartPoint(start);
          setEndPoint(end);
          setDistance(straightLineDistance);
          setRoute([start, end]);
          if (onRouteCalculated) {
            onRouteCalculated({
              distance: straightLineDistance,
              startPoint: start,
              endPoint: end,
              route: [start, end]
            });
          }
          return;
        }

        const profile = getTransportProfile(transportMode);
        const response = await api.post(
          '/api/routes/directions',
          {
            profile,
            start,
            end
          }
        );

        if (response.data?.success && response.data?.route?.coordinates?.length > 1) {
          const routeCoords = response.data.route.coordinates;
          const routeDistance = Number(response.data.route.distanceKm) || 0;

          setStartPoint(start);
          setEndPoint(end);
          setRoute(routeCoords);
          setDistance(routeDistance);

          if (onRouteCalculated) {
            onRouteCalculated({
              distance: routeDistance,
              startPoint: start,
              endPoint: end,
              route: routeCoords
            });
          }
        }
      } catch (error) {
        console.error('Error calculating route:', error);
        const straightLineDistance = calculateStraightLineDistance(start, end);
        setStartPoint(start);
        setEndPoint(end);
        setDistance(straightLineDistance);
        setRoute([start, end]);

        if (onRouteCalculated) {
          onRouteCalculated({
            distance: straightLineDistance,
            startPoint: start,
            endPoint: end,
            route: [start, end]
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [
      calculateStraightLineDistance,
      getTransportProfile,
      onRouteCalculated,
      transportMode
    ]
  );

  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        setAddressError('');

        if (!startPoint) {
          setStartPoint([lat, lng]);
          setEndPoint(null);
          setRoute(null);
          setDistance(0);
          if (onRouteCalculated) onRouteCalculated(null);
        } else if (!endPoint) {
          const end = [lat, lng];
          setEndPoint(end);
          calculateRouteBetween(startPoint, end);
        } else {
          setStartPoint([lat, lng]);
          setEndPoint(null);
          setRoute(null);
          setDistance(0);
          if (onRouteCalculated) onRouteCalculated(null);
        }
      }
    });
    return null;
  };

  const handleFindRouteByAddress = async () => {
    setAddressError('');
    const from = fromQuery.trim();
    const to = toQuery.trim();
    if (!from || !to) {
      setAddressError('Enter both From and To (places in India).');
      return;
    }

    setLoading(true);
    try {
      const start = await geocodeIndia(from);
      if (!start) {
        setAddressError(`Could not find “${from}”. Try a clearer name (e.g. city, landmark).`);
        return;
      }
      await delay(NOMINATIM_DELAY_MS);
      const end = await geocodeIndia(to);
      if (!end) {
        setAddressError(`Could not find “${to}”. Try a clearer name (e.g. city, landmark).`);
        return;
      }

      await calculateRouteBetween(start, end);
    } catch (err) {
      console.error(err);
      setAddressError('Place search failed. Check your connection or try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (userLocation) {
      setStartPoint(userLocation);
      setEndPoint(null);
      setRoute(null);
      setDistance(0);
      setAddressError('');
      if (onRouteCalculated) onRouteCalculated(null);
    }
  };

  useEffect(() => {
    if (startPoint && endPoint) {
      calculateRouteBetween(startPoint, endPoint);
    }
  }, [transportMode, startPoint, endPoint, calculateRouteBetween]);

  const clearMap = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRoute(null);
    setDistance(0);
    setFromQuery('');
    setToQuery('');
    setAddressError('');
    if (onRouteCalculated) onRouteCalculated(null);
  };

  const boundsPositions =
    route && route.length > 1 ? route : startPoint && endPoint ? [startPoint, endPoint] : null;

  const distanceLabel =
    startPoint && endPoint && distance > 0
      ? `Route distance: ${distance.toFixed(2)} km`
      : startPoint && !endPoint
        ? 'Set destination (map, address, or “To”)'
        : 'From / To addresses or tap map: start → end';

  return (
    <div className="map-route-shell">
      <div className="map-container redesign-map-box">
        <div className="map-address-section">
          <div className="map-address-grid">
            <div className="map-field">
              <label className="form-label" htmlFor="route-from">
                From
              </label>
              <input
                id="route-from"
                type="text"
                className="input map-address-input"
                placeholder="e.g. Connaught Place, Delhi"
                value={fromQuery}
                onChange={(e) => setFromQuery(e.target.value)}
                autoComplete="street-address"
              />
            </div>
            <div className="map-field">
              <label className="form-label" htmlFor="route-to">
                To
              </label>
              <input
                id="route-to"
                type="text"
                className="input map-address-input"
                placeholder="e.g. Jaipur Railway Station"
                value={toQuery}
                onChange={(e) => setToQuery(e.target.value)}
                autoComplete="street-address"
              />
            </div>
          </div>
          <div className="map-address-actions">
            <button type="button" className="btn map-primary-btn" onClick={handleFindRouteByAddress} disabled={loading}>
              {loading ? 'Working…' : 'Find route'}
            </button>
            <p className="map-address-hint">Searches are limited to India. You can still tap the map to pick points.</p>
          </div>
          {addressError && <div className="error map-address-error">{addressError}</div>}
        </div>

        <div className="map-header-row">
          <div className="distance-info">{distanceLabel}</div>
          <div className="map-actions">
            <button type="button" className="map-btn" onClick={useCurrentLocation} disabled={!userLocation}>
              Use my location
            </button>
            <button type="button" className="map-btn" onClick={clearMap}>
              Clear map
            </button>
          </div>
        </div>

        <div className="map-leaflet-frame">
          <MapContainer
            center={INDIA_CENTER}
            zoom={INDIA_ZOOM_OVERVIEW}
            minZoom={4}
            maxBounds={INDIA_MAX_BOUNDS}
            maxBoundsViscosity={0.85}
            style={{ height: '320px', width: '100%' }}
            ref={mapRef}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            <MapClickHandler />
            {boundsPositions && <FitRouteBounds positions={boundsPositions} />}

            {startPoint && (
              <Marker position={startPoint}>
                <Popup>
                  <strong>Start</strong>
                  <br />
                  {startPoint[0].toFixed(5)}, {startPoint[1].toFixed(5)}
                </Popup>
              </Marker>
            )}

            {endPoint && (
              <Marker position={endPoint}>
                <Popup>
                  <strong>End</strong>
                  <br />
                  {distance > 0 ? `${distance.toFixed(2)} km` : ''}
                </Popup>
              </Marker>
            )}

            {route && route.length > 1 && (
              <Polyline positions={route} color={ROUTE_COLOR} weight={4} opacity={0.85} />
            )}
          </MapContainer>
        </div>
      </div>

      {loading && (
        <div className="map-loading-banner" role="status">
          Calculating route…
        </div>
      )}
    </div>
  );
};

export default MapComponent;
