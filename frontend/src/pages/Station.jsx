import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getStation, startRide } from '../services/api';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 15, { duration: 0.9 });
  }, [center, map]);
  return null;
}

export default function Station() {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [station, setStation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [isRenting, setIsRenting] = useState(false);

  useEffect(() => {
    const fetchStation = async () => {
      try {
        setIsLoading(true);
        const data = await getStation(stationId);
        if (!data) {
          setError('Station not found');
          return;
        }
        setStation(data);
      } catch (err) {
        console.error('Failed to fetch station:', err);
        setError(err?.userFriendly || "We couldn't find this station. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    void fetchStation();
  }, [stationId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRentBike = async (bicycleId) => {
    if (isRenting) return;
    setIsRenting(true);
    try {
      const result = await startRide(bicycleId);
      if (result.success) {
        setToast(`${bicycleId} unlocked. Have a great ride!`);
        setTimeout(() => navigate('/home'), 2000);
      } else {
        setToast(result.message || 'Failed to rent bike');
      }
    } catch (err) {
      setToast(err?.userFriendly || "We couldn't start your ride. Please try again.");
    } finally {
      setIsRenting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="station-page">
        <header className="station-header">
          <Link to="/home" className="back-link">← Back</Link>
          <h1>Loading station...</h1>
        </header>
        <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Please wait</p>
      </main>
    );
  }

  if (error || !station) {
    return (
      <main className="station-page">
        <header className="station-header">
          <Link to="/home" className="back-link">← Back</Link>
          <h1>Station Error</h1>
        </header>
        <section style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'red' }}>{error || 'Station not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/home')}>Return to Home</button>
        </section>
      </main>
    );
  }

  const center = [station.lat, station.lng];
  return (
    <main className="station-page">
      <header className="station-header">
        <Link to="/home" className="back-link">← Back to map</Link>
        <div>
          <p className="eyebrow">Station Details</p>
          <h1>{station.name}</h1>
          <p className="station-location">{station.city}</p>
        </div>
      </header>

      <div className="station-content">
        <section className="station-info-panel">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Station ID</span>
              <b className="info-value">{station.id}</b>
            </div>
            <div className="info-item">
              <span className="info-label">Available Bicycles</span>
              <b className="info-value">{station.available}</b>
            </div>
            <div className="info-item">
              <span className="info-label">Station Capacity</span>
              <b className="info-value">{station.capacity}</b>
            </div>
            <div className="info-item">
              <span className="info-label">Availability Rate</span>
              <b className="info-value">{Math.round((station.available / station.capacity) * 100)}%</b>
            </div>
          </div>
        </section>

        <section className="map-section">
          <MapContainer center={center} zoom={15} className="station-map" zoomControl={false}>
            <FlyTo center={center} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={center}>
              <div className="station-marker">{station.name}</div>
            </Marker>
          </MapContainer>
        </section>

        <section className="bicycles-section">
          <div className="section-header">
            <h2>Available Bicycles</h2>
            <span className="count">{station.bicycles?.length || 0} bikes</span>
          </div>

          {!station.bicycles || station.bicycles.length === 0 ? (
            <div className="empty-state">
              <p>No bicycles available at this station right now.</p>
              <p className="muted">Check back later or visit another station.</p>
            </div>
          ) : (
            <div className="bicycles-grid">
              {station.bicycles.map((bike) => (
                <article key={bike.id} className="bicycle-card">
                  <div className="bike-header">
                    <h3>{bike.id}</h3>
                    <span className={`status-badge ${bike.health === 'Good' ? 'good' : 'maintenance'}`}>
                      {bike.health}
                    </span>
                  </div>

                  <div className="bike-details">
                    <div className="detail-row">
                      <span>Battery</span>
                      <b>{bike.battery_level}%</b>
                    </div>
                    <div className="detail-row">
                      <span>Network</span>
                      <b>{bike.network_status}</b>
                    </div>
                    <div className="detail-row">
                      <span>Status</span>
                      <b>{bike.is_locked ? 'Locked' : 'In Use'}</b>
                    </div>
                    <div className="detail-row">
                      <span>Air Pressure</span>
                      <b>Good</b>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary full-width rent-button"
                    onClick={() => handleRentBike(bike.id)}
                    disabled={isRenting || !bike.is_locked || bike.health !== 'Good'}
                  >
                    {isRenting ? 'Processing...' : '🚲 Rent Cycle'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && <div className="velo-toast">{toast}</div>}

      <style>{`
        .station-page {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #f5f5f5;
        }

        .station-header {
          background: white;
          border-bottom: 1px solid #e0e0e0;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .back-link {
          text-decoration: none;
          color: #007bff;
          font-weight: 500;
          white-space: nowrap;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .station-header div {
          flex: 1;
        }

        .station-header h1 {
          margin: 0;
          font-size: 1.5rem;
        }

        .station-location {
          margin: 0.25rem 0 0 0;
          color: #666;
          font-size: 0.9rem;
        }

        .eyebrow {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #999;
          margin: 0;
        }

        .station-content {
          flex: 1;
          padding: 1rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .station-info-panel {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
        }

        .info-label {
          font-size: 0.85rem;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .info-value {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .map-section {
          margin-bottom: 1.5rem;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .station-map {
          height: 300px;
          width: 100%;
        }

        .station-marker {
          background: white;
          padding: 0.5rem;
          border-radius: 4px;
          font-weight: 500;
          font-size: 0.8rem;
        }

        .bicycles-section {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 1rem;
        }

        .section-header h2 {
          margin: 0;
          font-size: 1.2rem;
        }

        .count {
          background: #f0f0f0;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          color: #666;
        }

        .bicycles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .bicycle-card {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1rem;
          transition: all 0.2s ease;
        }

        .bicycle-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: #007bff;
        }

        .bike-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .bike-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .status-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.good {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.maintenance {
          background: #f8d7da;
          color: #721c24;
        }

        .bike-details {
          margin-bottom: 1rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          font-size: 0.9rem;
        }

        .detail-row span {
          color: #666;
        }

        .detail-row b {
          font-weight: 600;
        }

        .rent-button {
          width: 100%;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #999;
        }

        .empty-state p {
          margin: 0.5rem 0;
        }

        .muted {
          font-size: 0.9rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.95rem;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .full-width {
          width: 100%;
        }

        .velo-toast {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 768px) {
          .bicycles-grid {
            grid-template-columns: 1fr;
          }

          .station-map {
            height: 250px;
          }

          .station-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
