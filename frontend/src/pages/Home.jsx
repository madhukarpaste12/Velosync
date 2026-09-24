import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import {
  endRideWithOfflineFallback,
  syncOfflineRides,
  getStations,
  getUserProfile,
  buildRideEndPayload
} from '../services/api';
import { startGpsTracking } from '../services/gpsTracker';
import { easeOutCubic, movePositionByMeters } from '../utils/geoUtils.js';
import QrCodeScanner from '../components/QrCodeScanner';
import 'leaflet/dist/leaflet.css';

const CITIES = { Mumbai: [19.076, 72.8777], Pune: [18.5204, 73.8567], Bengaluru: [12.9716, 77.5946] };
const rupees = (value) => `₹${Number(value).toFixed(2)}`;
const stationIcon = (available, bounty) => L.divIcon({ className: 'velo-marker-shell', html: `<div class="velo-marker ${bounty ? 'is-bounty' : ''}">🚲<b>${available}</b></div>`, iconSize: [48, 48], iconAnchor: [24, 42], popupAnchor: [0, -42] });
const userLocationIcon = L.divIcon({ className: 'user-location-marker', html: '<div class="location-dot">📍</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
const bicycleLocationIcon = L.divIcon({ className: 'bicycle-location-marker', html: '<div class="bike-dot">🚲</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

const animateToPosition = ({ from, to, setter, frameRef, previousRef }) => {
  if (!from || !to) {
    setter(Array.isArray(to) ? to : [to?.latitude ?? from.latitude, to?.longitude ?? from.longitude]);
    if (to) previousRef.current = to;
    return;
  }

  if (frameRef.current) {
    cancelAnimationFrame(frameRef.current);
  }

  const start = performance.now();
  const duration = 900;

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = easeOutCubic(progress);
    const interpolated = {
      latitude: Number(from.latitude) + (Number(to.latitude) - Number(from.latitude)) * eased,
      longitude: Number(from.longitude) + (Number(to.longitude) - Number(from.longitude)) * eased,
    };

    setter([interpolated.latitude, interpolated.longitude]);

    if (progress < 1) {
      frameRef.current = requestAnimationFrame(tick);
      return;
    }

    previousRef.current = to;
    setter([Number(to.latitude), Number(to.longitude)]);
  };

  frameRef.current = requestAnimationFrame(tick);
};

const animateObjectPosition = ({ from, to, setter, frameRef, previousRef }) => {
  if (!from || !to) {
    setter(to ?? from);
    if (to) previousRef.current = to;
    return;
  }

  if (frameRef.current) {
    cancelAnimationFrame(frameRef.current);
  }

  const start = performance.now();
  const duration = 900;

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = easeOutCubic(progress);
    const interpolated = {
      latitude: Number(from.latitude) + (Number(to.latitude) - Number(from.latitude)) * eased,
      longitude: Number(from.longitude) + (Number(to.longitude) - Number(from.longitude)) * eased,
    };

    setter(interpolated);

    if (progress < 1) {
      frameRef.current = requestAnimationFrame(tick);
      return;
    }

    previousRef.current = to;
    setter({ latitude: Number(to.latitude), longitude: Number(to.longitude) });
  };

  frameRef.current = requestAnimationFrame(tick);
};

function MapControls({ onMyLocation, isGettingLocation, hasLocation }) {
  return (
    <div className="map-controls-container">
      <button className={`location-button ${hasLocation ? 'has-location' : ''}`} onClick={onMyLocation} disabled={isGettingLocation} aria-label="Show my location" title="Show my location">
        <span className={`location-target ${isGettingLocation ? 'is-loading' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}

function MapReady({ center }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(map.getContainer());
    const resizeTimer = setTimeout(() => map.invalidateSize(), 100);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimer);
    };
  }, [map]);

  useEffect(() => { map.flyTo(center, 13, { duration: 0.9 }); }, [center, map]);

  return null;
}

export default function Home() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const mapRef = useRef(null);
  const userAnimationFrameRef = useRef(null);
  const bikeAnimationFrameRef = useRef(null);
  const lastUserPositionRef = useRef(null);
  const lastBikePositionRef = useRef(null);
  const [city, setCity] = useState('Mumbai');
  const [stations, setStations] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [wallet, setWallet] = useState(0);
  const [ride, setRide] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [history, setHistory] = useState([]);
  const [panel, setPanel] = useState('');
  const [toast, setToast] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [issue, setIssue] = useState({ asset: '', type: 'Solenoid Lock Glitch', notes: '' });
  const [userLocation, setUserLocation] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [bicyclePosition, setBicyclePosition] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [trackingRoute, setTrackingRoute] = useState([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const visibleStations = useMemo(() => stations, [stations]);

  // Fetch user profile on mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const profile = await getUserProfile();
        if (profile) {
          setUserProfile(profile);
          setWallet(profile.wallet_balance || 0);
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };
    void fetchUserProfile();
  }, []);

  // Fetch stations when city changes
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const stationsData = await getStations(city);
        setStations(stationsData);
      } catch (error) {
        console.error('Failed to fetch stations:', error);
        setStations([]);
      }
    };
    void fetchStations();
  }, [city]);

  const hasActiveRide = Boolean(ride && ride.tripId);
  const fare = ride ? 10 + seconds * 0.45 : 0;
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  
  useEffect(() => {
    if (!navigator.geolocation) {
      return undefined;
    }

    const cleanup = startGpsTracking({
      onPosition: (position) => {
        const nextPosition = {
          latitude: Number(position.latitude),
          longitude: Number(position.longitude),
          accuracy: Number(position.accuracy ?? 25),
          speed: position.speed,
          heading: position.heading,
          timestamp: position.timestamp,
        };

        setUserPosition((previous) => {
          const start = previous ?? nextPosition;
          animateToPosition({
            from: start,
            to: nextPosition,
            setter: setUserLocation,
            frameRef: userAnimationFrameRef,
            previousRef: lastUserPositionRef
          });
          return nextPosition;
        });

        setLocationAccuracy(nextPosition.accuracy);
        const newLocation = [nextPosition.latitude, nextPosition.longitude];
        setUserLocation(newLocation);
        setTrackingRoute((prev) => [...prev.slice(-59), newLocation]);
      },
      onError: (error) => {
        let message = 'Unable to get your location.';
        if (error?.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable it in your browser settings.';
        } else if (error?.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable.';
        } else if (error?.code === error.TIMEOUT) {
          message = 'Location request timed out.';
        }
        setToast(message);
      },
      onStatus: ({ valid, reason }) => {
        if (!valid) {
          setToast(reason === 'low-accuracy' ? 'Location accuracy is poor right now, waiting for a better fix.' : 'GPS signal was unstable and ignored a noisy reading.');
        }
      }
    });

    return () => {
      cleanup();
      const userFrame = userAnimationFrameRef.current;
      const bikeFrame = bikeAnimationFrameRef.current;
      if (userFrame) cancelAnimationFrame(userFrame);
      if (bikeFrame) cancelAnimationFrame(bikeFrame);
    };
  }, []);

  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setToast('Geolocation is not supported by your browser.');
      return;
    }

    if (isGettingLocation) return;
    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const nextPosition = { latitude, longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp };
        setUserLocation([latitude, longitude]);
        setUserPosition(nextPosition);
        setLocationAccuracy(position.coords.accuracy);
        if (mapRef.current) {
          mapRef.current.flyTo([latitude, longitude], 15, { duration: 0.9 });
        }
        setToast('Location found! 📍');
        setIsGettingLocation(false);
      },
      (error) => {
        let message = 'Unable to get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable it in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out.';
        }
        setToast(message);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [isGettingLocation]);

  useEffect(() => {
    if (!ride) {
      return undefined;
    }

    const origin = { latitude: Number(ride.lat), longitude: Number(ride.lng) };
    let bearing = 54;
    let counter = 0;

    const tick = () => {
      const updated = movePositionByMeters(origin.latitude, origin.longitude, 0.65 + (counter % 3) * 0.2, bearing);
      bearing = (bearing + 8 + (counter % 5)) % 360;
      counter += 1;

      const nextPosition = {
        latitude: updated.latitude,
        longitude: updated.longitude,
        accuracy: 4,
        timestamp: Date.now(),
      };

      const from = lastBikePositionRef.current ?? origin;
      animateObjectPosition({
        from,
        to: nextPosition,
        setter: setBicyclePosition,
        frameRef: bikeAnimationFrameRef,
        previousRef: lastBikePositionRef
      });

      bikeAnimationFrameRef.current = requestAnimationFrame(tick);
    };

    bikeAnimationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (bikeAnimationFrameRef.current) cancelAnimationFrame(bikeAnimationFrameRef.current);
      bikeAnimationFrameRef.current = null;
    };
  }, [ride]);
  
  useEffect(() => { if (!ride) return undefined; const timer = setInterval(() => setSeconds((value) => value + 1), 1000); return () => clearInterval(timer); }, [ride]);
  useEffect(() => { const onOnline = () => { setOnline(true); void syncOfflineRides(); setToast('Back online — cached updates are syncing.'); }; const onOffline = () => setOnline(false); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); }; }, []);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  
  const startRide = useCallback(() => {
    setIsScannerOpen(true);
  }, []);

  const handleValidQrScan = useCallback((bicycle) => {
    if (!bicycle) {
      setToast('Invalid VeloSync QR Code');
      setIsScannerOpen(false);
      return;
    }

    const stationId = bicycle.station_id || visibleStations.find((station) => station.available > 0)?.id;
    setIsScannerOpen(false);

    if (!stationId) {
      setToast('No station is currently available for this bicycle.');
      return;
    }

    setToast(`${bicycle.id} scanned successfully.`);
    navigate(`/station/${stationId}`);
  }, [navigate, visibleStations]);

  const endRide = async () => {
    if (!ride) return;

    const payload = buildRideEndPayload({
      tripId: ride.tripId,
      bikeId: ride.bikeId,
      lat: ride.lat,
      lng: ride.lng,
      simulatedOffline: !online
    });

    const bounty = ride.station.available / ride.station.capacity < .2;
    const finalFare = Math.max(0, Number(fare.toFixed(2)) - (bounty ? 5 : 0));

    try {
      const result = await endRideWithOfflineFallback(payload);
      setToast(result.offline ? 'Cycle locked locally. It will sync automatically.' : 'Ride ended and cycle locked securely.');
    } catch {
      localStorage.setItem('offlineQueue', JSON.stringify([...JSON.parse(localStorage.getItem('offlineQueue') || '[]'), payload]));
      setToast('Ride saved locally for background sync.');
    }

    setWallet((value) => value - finalFare);
    setHistory((all) => [{ bike: ride.bikeId, date: 'Just now', duration, fare: finalFare, status: bounty ? 'Bounty Applied' : 'Completed' }, ...all]);
    setTrackingRoute([]);
    setBicyclePosition(null);
    lastBikePositionRef.current = null;
    setRide(null);
  };
  
  const topUp = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setToast('Enter an amount greater than ₹0 to add balance.');
      return;
    }
    setCustomAmount(String(value));
    setPanel('');
    navigate('/payment', { state: { amount: value } });
  };
  
  const submitIssue = (event) => { event.preventDefault(); setPanel(''); setIssue({ asset: '', type: 'Solenoid Lock Glitch', notes: '' }); setToast('Issue reported. Our field team has been notified.'); };
  const handleLogout = async () => { if (isLoggingOut) return; setIsLoggingOut(true); setToast('Logging out...'); try { await logout(); } finally { window.location.replace('/'); } };
  
  return <main className="velo-app"><MapContainer ref={mapRef} center={CITIES[city]} zoom={13} className="velo-map" zoomControl={false}><MapReady center={CITIES[city]} /><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{userLocation && <><Circle center={userLocation} radius={locationAccuracy || 30} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 1 }} /><Marker position={userLocation} icon={userLocationIcon}><Popup>Your current location</Popup></Marker></>}{trackingRoute.length > 0 && <Polyline positions={trackingRoute} color="#007bff" weight={3} opacity={0.8} />}{visibleStations.map((station) => { const bounty = station.available / station.capacity < .2; return <Marker key={station.id} position={[station.lat, station.lng]} icon={stationIcon(station.available, bounty)}><Popup><div className="station-popup"><span>{station.id}</span><h3>{station.name}</h3><p><b>{station.available}</b> cycles · {station.capacity} docks</p>{bounty && <div className="bounty-tag">⚡ ₹5 Rebalancing Bounty</div>}<button className="button button-primary" onClick={() => navigate(`/station/${station.id}`)}>View station & rent</button></div></Popup></Marker>; })}
{userPosition && <Marker position={[userPosition.latitude, userPosition.longitude]} icon={userLocationIcon}><Popup>You are here</Popup></Marker>}
{ride && bicyclePosition && <Marker position={[bicyclePosition.latitude, bicyclePosition.longitude]} icon={bicycleLocationIcon}><Popup><div className="station-popup"><span>Ride</span><h3>Bicycle {ride.bikeId || 'in motion'}</h3><p>{duration}</p></div></Popup></Marker>}
<MapControls onMyLocation={handleMyLocation} isGettingLocation={isGettingLocation} hasLocation={Boolean(userLocation)} /></MapContainer>
    <header className="velo-nav glass-panel"><div className="nav-left"><button className="icon-button" onClick={() => setPanel('profile')} aria-label="Open profile">👤</button><label className="city-select">📍<select value={city} onChange={(event) => setCity(event.target.value)}>{Object.keys(CITIES).map((name) => <option key={name}>{name}</option>)}</select></label></div><div className="nav-right"><div className="wallet-pill"><span>Wallet</span><b>{rupees(wallet)}</b><button onClick={() => setPanel('topup')}>+ Top up</button></div><button className="icon-button" onClick={() => setPanel('report')} aria-label="Report an issue">⚠️</button></div></header>
    <section className={`ride-drawer ${hasActiveRide ? 'is-riding' : ''}`}>{hasActiveRide ? <><div className="ride-status"><i />Ride in progress</div><div className="ride-metrics"><div><span>Bicycle</span><b>{ride.bikeId}</b></div><div><span>Duration</span><b>{duration}</b></div><div><span>Live fare</span><b>{rupees(fare)}</b></div></div><button id="ride-end-button" className="button button-danger" onClick={endRide}>🔒 End ride & lock</button></> : <><div><p className="drawer-kicker">Ready when you are</p><h1>Find your next ride</h1><p>Tap a station on the map or scan a cycle code.</p></div><button id="ride-start-button" className="button button-primary scan-button" onClick={startRide}>📷 Scan QR to rent</button></>}</section>
    {isScannerOpen && <QrCodeScanner onClose={() => setIsScannerOpen(false)} onValidScan={handleValidQrScan} setToast={setToast} />}
    {panel === 'profile' && <div className="modal-layer"><aside className="profile-drawer glass-panel"><button className="close-button" onClick={() => setPanel('')}>×</button><div className="profile-hero"><div className="avatar">🚴</div><div><p>Good to see you</p><h2>{userProfile?.name || 'User'}</h2><em>✓ KYC verified</em></div></div><div className="identity-grid"><div><span>Email</span><b>{userProfile?.email || 'N/A'}</b></div><div><span>Phone</span><b>{userProfile?.phone || 'Not provided'}</b></div><div><span>Role</span><b>{userProfile?.role || 'Commuter'}</b></div><div><span>Wallet</span><b>{rupees(wallet)}</b></div></div><div className="stat-grid"><div><b>{history.length}</b><span>Total trips</span></div><div><b>18.6 kg</b><span>CO₂ saved</span></div></div><div className="ledger-head"><h3>Ride history</h3><span>Recent trips</span></div><div className="ride-ledger">{history.length === 0 ? <p style={{textAlign: 'center', color: '#666'}}>No trips yet</p> : history.map((item, index) => <article key={`${item.bike}-${index}`}><div><b>{item.bike}</b><span>{item.date} · {item.duration}</span></div><div><strong>{rupees(item.fare)}</strong><em className={item.status === 'Bounty Applied' ? 'bounty-status' : ''}>{item.status}</em></div></article>)}</div><div className="profile-actions"><button className="button button-primary" onClick={() => setPanel('topup')}>Top-up wallet</button><button className="button button-secondary" onClick={() => setToast('Referral code VS-' + (userProfile?.id?.slice(0, 5) || 'USER') + ' copied!')}>Refer & earn</button><button className="logout-button" onClick={handleLogout} disabled={isLoggingOut}>{isLoggingOut ? 'Logging out...' : 'Logout'}</button></div></aside></div>}
    {panel === 'simulator' && <div className="modal-layer modal-bottom"><section className="simulator-panel"><button className="close-button" onClick={() => setPanel('')}>×</button><p className="drawer-kicker">Developer tools</p><h2>IoT hardware simulator</h2><p>Simulate connectivity changes and verify background ride sync.</p><div className="sim-toggle"><button className={online ? 'selected' : ''} onClick={() => setOnline(true)}>🟢 4G/LTE online</button><button className={!online ? 'selected offline-button' : ''} onClick={() => setOnline(false)}>🔴 Offline dead-zone</button></div><div className="sim-info"><span>BLE fallback</span><b>{online ? 'Standby' : 'Ready to lock locally'}</b></div></section></div>}
    {panel === 'topup' && <div className="modal-layer"><section className="dialog-card"><button className="close-button" onClick={() => setPanel('')}>×</button><p className="drawer-kicker">Wallet</p><h2>Top-up balance</h2><p>Choose an amount and continue to payment method selection.</p><div className="amount-pills">{[50, 100, 200, 500].map((amount) => <button key={amount} onClick={() => topUp(amount)}>+{rupees(amount)}</button>)}</div><input className="amount-input" value={customAmount} onChange={(event) => setCustomAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="Custom amount" inputMode="decimal" /><button className="button button-primary full-width" onClick={() => { const value = Number(customAmount); if (!Number.isFinite(value) || value <= 0) { setToast('Enter an amount greater than ₹0 before continuing.'); return; } setPanel(''); navigate('/payment', { state: { amount: value } }); }}>Continue to payment</button></section></div>}
    {panel === 'report' && <div className="modal-layer"><form className="dialog-card report-form" onSubmit={submitIssue}><button type="button" className="close-button" onClick={() => setPanel('')}>×</button><p className="drawer-kicker">Maintenance</p><h2>Report an issue</h2><input required value={issue.asset} onChange={(event) => setIssue({ ...issue, asset: event.target.value })} placeholder="Station or bicycle ID" /><select value={issue.type} onChange={(event) => setIssue({ ...issue, type: event.target.value })}>{['Solenoid Lock Glitch', 'Flat Tyre', 'Vandalism', 'Geofence Error'].map((type) => <option key={type}>{type}</option>)}</select><textarea value={issue.notes} onChange={(event) => setIssue({ ...issue, notes: event.target.value })} placeholder="Describe what happened (optional)" rows="4" /><button className="button button-primary" type="submit">Submit report</button></form></div>}{toast && <div className="velo-toast">{toast}</div>}
    
    <style>{`
      .map-controls-container {
        position: absolute;
        bottom: 215px;
        right: 14px;
        z-index: 400;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .location-button {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: white;
        border: 1px solid #d7dee8;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.22);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        padding: 0;
      }

      .location-button:hover {
        background: #f5f5f5;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.28);
      }

      .location-button:active {
        transform: scale(0.95);
      }

      .location-button:disabled {
        cursor: wait;
        opacity: 0.75;
      }

      .location-target {
        position: relative;
        width: 18px;
        height: 18px;
        border: 2px solid #64748b;
        border-radius: 50%;
      }

      .location-target::before,
      .location-target::after {
        content: '';
        position: absolute;
        background: #64748b;
      }

      .location-target::before {
        width: 2px;
        height: 24px;
        left: 6px;
        top: -5px;
      }

      .location-target::after {
        width: 24px;
        height: 2px;
        left: -5px;
        top: 6px;
      }

      .location-button.has-location .location-target {
        border-color: #2563eb;
      }

      .location-button.has-location .location-target::before,
      .location-button.has-location .location-target::after {
        background: #2563eb;
      }

      .location-target.is-loading {
        animation: locate-spin 0.9s linear infinite;
      }

      @keyframes locate-spin {
        to { transform: rotate(360deg); }
      }

      .location-dot {
        font-size: 16px;
        display: block;
      }

      .glass-panel {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border: 1px solid rgba(148, 163, 184, 0.28);
        box-shadow: 0 8px 26px rgba(15, 23, 42, 0.14);
      }

      @media (max-width: 699px) {
        .map-controls-container { bottom: 205px; }
      }
    `}</style>
  </main>;
}
