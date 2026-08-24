import { useState, useEffect } from 'react';
import api from '../services/api';

const IoTSimulator = () => {
  const [telemetry, setTelemetry] = useState({
    deviceId: 'bbbbbbbb-1111-1111-1111-111111111111', // Seed data bike
    lat: 15.9010,
    lng: 73.8160,
    battery: 100,
    network: 'ONLINE',
    isLocked: true
  });

  // Automatically push telemetry data every 3 seconds to backend
  useEffect(() => {
    const interval = setInterval(async () => {
      await api.post(`/iot/devices/${telemetry.deviceId}/telemetry`, telemetry);
    }, 3000);
    return () => clearInterval(interval);
  }, [telemetry]);

  return (
    <div className="iot-simulator">
      <h2>VeloSync IoT Hardware Simulator</h2>
      <div className="sim-card">
        <label>Latitude: <input type="number" step="0.001" value={telemetry.lat} onChange={e => setTelemetry({...telemetry, lat: parseFloat(e.target.value)})} /></label>
        <label>Longitude: <input type="number" step="0.001" value={telemetry.lng} onChange={e => setTelemetry({...telemetry, lng: parseFloat(e.target.value)})} /></label>
        <label>Battery Level (%): <input type="range" min="0" max="100" value={telemetry.battery} onChange={e => setTelemetry({...telemetry, battery: parseInt(e.target.value)})} /></label>
        
        <label>Hardware Lock (Solenoid):
          <select value={telemetry.isLocked} onChange={e => setTelemetry({...telemetry, isLocked: e.target.value === 'true'})}>
            <option value="true">🔒 LOCKED</option>
            <option value="false">🔓 UNLOCKED</option>
          </select>
        </label>
      </div>
      <p>Data is actively streaming to Node.js via HTTP POST...</p>
    </div>
  );
};
export default IoTSimulator;
