import { useEffect, useRef, useState } from 'react'
import { fetchAlertsFeed, connectAlertsSocket } from './api'

function normalizeIncoming(msg) {
  if (msg.source === 'vehicle') {
    return {
      source: 'vehicle',
      id: msg.id,
      camera_id: msg.camera_id,
      headline: `${msg.alert_type} — ${msg.plate_number || 'unknown plate'}`,
      details: msg.details,
      severity: msg.severity,
      status: msg.status,
      timestamp: msg.triggered_at || new Date().toISOString(),
    }
  }
  // person alert — shape sent by person/alerts/send_to_core.py
  return {
    source: 'person',
    id: msg.alert_id,
    camera_id: msg.camera_id,
    headline: `${msg.category} person match (${Number(msg.similarity_score || 0).toFixed(2)} similarity)`,
    details: msg.crop_image_path ? `Crop saved: ${msg.crop_image_path}` : null,
    severity: msg.category === 'wanted' ? 'HIGH' : 'MEDIUM',
    status: 'pending',
    timestamp: new Date().toISOString(),
  }
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)
  const [loadError, setLoadError] = useState('')
  const wsRef = useRef(null)

  useEffect(() => {
    fetchAlertsFeed()
      .then(setAlerts)
      .catch(() => setLoadError('Could not load alert history.'))

    const ws = connectAlertsSocket((msg) => {
      setAlerts((prev) => [normalizeIncoming(msg), ...prev].slice(0, 200))
    })
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => ws.close()
  }, [])

  const vehicleCount = alerts.filter((a) => a.source === 'vehicle').length
  const personCount = alerts.filter((a) => a.source === 'person').length
  const highSeverityCount = alerts.filter((a) => a.severity === 'HIGH').length

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Live Alert Dashboard</h2>
        <span className={`ws-status ${connected ? 'live' : 'offline'}`}>
          <span className="dot" /> {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div className="dashboard-cards">
        <div className="dash-card">
          <span className="dash-card-value">{alerts.length}</span>
          <span className="dash-card-label">Total alerts</span>
        </div>
        <div className="dash-card">
          <span className="dash-card-value">{vehicleCount}</span>
          <span className="dash-card-label">Vehicle alerts</span>
        </div>
        <div className="dash-card">
          <span className="dash-card-value">{personCount}</span>
          <span className="dash-card-label">Person alerts</span>
        </div>
        <div className="dash-card highlight">
          <span className="dash-card-value">{highSeverityCount}</span>
          <span className="dash-card-label">High severity</span>
        </div>
      </div>

      {loadError && <p className="form-error">{loadError}</p>}

      <div className="dashboard-feed">
        <h3>Live feed</h3>
        {alerts.length === 0 && <p className="hint">No alerts yet — waiting for a watchlist match.</p>}
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={`${a.source}-${a.id}`} className={`alert-item severity-${(a.severity || '').toLowerCase()}`}>
              <span className={`alert-badge ${a.source}`}>{a.source}</span>
              <strong>{a.headline}</strong> at <strong>{a.camera_id}</strong>
              {a.details && <div className="alert-reason">{a.details}</div>}
              <div className="alert-time">{new Date(a.timestamp).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}