import { useEffect, useState } from 'react'
import { fetchAlerts, connectAlertsSocket, trackVehicle } from './api'

export default function LiveView({ onTrackResult }) {
  const [alerts, setAlerts] = useState([])
  const [plateInput, setPlateInput] = useState('')
  const [trackResult, setTrackResult] = useState(null)
  const [trackError, setTrackError] = useState('')

  useEffect(() => {
    fetchAlerts().then(setAlerts)

    // Live push — new alerts appear at the top the instant core creates them.
    const ws = connectAlertsSocket((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev])
    })
    return () => ws.close()
  }, [])

  async function handleTrack(e) {
    e.preventDefault()
    setTrackError('')
    setTrackResult(null)
    if (!plateInput.trim()) return
    try {
      const events = await trackVehicle(plateInput.trim())
      if (events.length === 0) {
        setTrackError('No detections found for this vehicle yet.')
      } else {
        setTrackResult(events)
        onTrackResult(events)   // tells App to draw the route on MapView
      }
    } catch (err) {
      setTrackError('Tracking failed — check the backend is running.')
    }
  }

  return (
    <div className="live-view">
      <div className="live-column">
        <h3>Track a vehicle</h3>
        <form onSubmit={handleTrack} className="track-form">
          <input
            placeholder="Vehicle registration number"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
          />
          <button type="submit">Track</button>
        </form>
        {trackError && <p className="form-error">{trackError}</p>}
        {trackResult && (
          <div className="track-results">
            <p><strong>{trackResult.length}</strong> detection(s), in order:</p>
            <ol>
              {trackResult.map((e) => (
                <li key={e.id}>
                  <strong>{e.camera_id}</strong> — {new Date(e.timestamp).toLocaleString()}
                  {e.speed_kmph ? ` — ${e.speed_kmph} km/h` : ''}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="live-column">
        <h3>Live alerts</h3>
        {alerts.length === 0 && <p className="hint">No alerts yet — waiting for a watchlist match.</p>}
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.id} className="alert-item">
              <span className={`alert-badge ${a.source_type}`}>{a.source_type}</span>
              <strong>{a.matched_value}</strong> at <strong>{a.camera_id}</strong>
              <div className="alert-reason">{a.reason}</div>
              <div className="alert-time">{new Date(a.timestamp).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
