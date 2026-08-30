import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { trackVehicle } from './api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function trackPointIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#0b3d66;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.5)"></div>`,
    iconSize: [10, 10],
  })
}

function lastKnownIcon() {
  return L.divIcon({ className: '', html: `<div class="pulse-dot"></div>`, iconSize: [18, 18] })
}

export default function LiveView() {
  const [plateInput, setPlateInput] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTrack(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    if (!plateInput.trim()) return
    setLoading(true)
    try {
      const data = await trackVehicle(plateInput.trim())
      if (data.total_detections === 0) {
        setError('No detections found for this vehicle yet.')
      } else {
        setResult(data)
      }
    } catch (err) {
      setError('Tracking failed — check the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const routePoints = (result?.points || []).filter((p) => p.latitude && p.longitude)
  const hasLast = result?.last_latitude && result?.last_longitude
  const mapCenter = hasLast ? [result.last_latitude, result.last_longitude] : [22.2587, 71.1924]

  return (
    <div className="track-page">
      <div className="track-panel">
        <h3>Track a vehicle</h3>
        <form onSubmit={handleTrack} className="track-form">
          <input
            placeholder="Vehicle registration number"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
          />
          <button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Track'}</button>
        </form>
        {error && <p className="form-error">{error}</p>}

        {result && (
          <>
            <div className="track-summary">
              <div><span className="label">Plate</span><strong>{result.plate_number}</strong></div>
              <div><span className="label">Detections</span><strong>{result.total_detections}</strong></div>
              <div><span className="label">First seen</span><strong>{result.first_seen ? new Date(result.first_seen).toLocaleString() : '—'}</strong></div>
              <div><span className="label">Last seen</span><strong>{result.last_seen ? new Date(result.last_seen).toLocaleString() : '—'}</strong></div>
              <div><span className="label">Last camera</span><strong>{result.last_camera_id || '—'}</strong></div>
            </div>

            <div className="track-table-wrap">
              <table className="track-table">
                <thead>
                  <tr>
                    <th>Camera</th><th>Type</th><th>When</th><th>Confidence</th>
                    <th>Speed</th><th>Helmet</th><th>Snapshot</th>
                  </tr>
                </thead>
                <tbody>
                  {result.points.map((p) => (
                    <tr key={p.id}>
                      <td>{p.camera_name || p.camera_id}</td>
                      <td>{p.event_type}</td>
                      <td>{new Date(p.created_at).toLocaleString()}</td>
                      <td>{(p.confidence * 100).toFixed(0)}%</td>
                      <td>{p.speed_kmph ? `${p.speed_kmph} km/h` : '—'}</td>
                      <td>{p.helmet_status || '—'}</td>
                      <td>{p.snapshot_url ? <a href={p.snapshot_url} target="_blank" rel="noreferrer">View</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="track-map">
        <MapContainer center={mapCenter} zoom={hasLast ? 12 : 7} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors'
                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {routePoints.map((p) => (
            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={trackPointIcon()}>
              <Popup>
                <strong>{p.camera_name || p.camera_id}</strong><br />
                {p.event_type} — {new Date(p.created_at).toLocaleString()}
              </Popup>
            </Marker>
          ))}
          {routePoints.length > 1 && (
            <Polyline positions={routePoints.map((p) => [p.latitude, p.longitude])}
                      pathOptions={{ color: '#0b3d66', weight: 3, dashArray: '6 6' }} />
          )}
          {hasLast && (
            <Marker position={[result.last_latitude, result.last_longitude]} icon={lastKnownIcon()}>
              <Popup>
                <strong>Last known location</strong><br />
                {result.last_camera_id}<br />
                {new Date(result.last_seen).toLocaleString()}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  )
}