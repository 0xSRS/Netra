import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { trackVehicle, searchPersonByPhoto, fetchCameras } from './api'

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

function personMatchIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#7a2e8f;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.5)"></div>`,
    iconSize: [12, 12],
  })
}

export default function LiveView() {
  const [mode, setMode] = useState('vehicle') // 'vehicle' | 'person'

  // ---- vehicle search state (unchanged behavior) ----
  const [plateInput, setPlateInput] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ---- person search state ----
  const [personFile, setPersonFile] = useState(null)
  const [personPreviewUrl, setPersonPreviewUrl] = useState('')
  const [personMatches, setPersonMatches] = useState(null)
  const [personError, setPersonError] = useState('')
  const [personLoading, setPersonLoading] = useState(false)
  const [cameras, setCameras] = useState([])

  useEffect(() => {
    // Needed to join person-search matches (camera_id + detected_at only)
    // against real coordinates, since person/search_person.py doesn't
    // return lat/long itself.
    fetchCameras().then(setCameras).catch(() => setCameras([]))
  }, [])

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

  function handlePersonFileChange(e) {
    const file = e.target.files?.[0] || null
    setPersonFile(file)
    setPersonPreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  async function handlePersonSearch(e) {
    e.preventDefault()
    setPersonError('')
    setPersonMatches(null)
    if (!personFile) {
      setPersonError('Choose a reference photo first.')
      return
    }
    setPersonLoading(true)
    try {
      const data = await searchPersonByPhoto(personFile)
      if (!data.matches || data.matches.length === 0) {
        setPersonError('No matching sightings found for this photo.')
      } else {
        // Join each match's camera_id against the camera registry to get
        // lat/long + a display name for the map and table.
        const enriched = data.matches.map((m) => {
          const cam = cameras.find((c) => c.camera_id === m.camera_id)
          return {
            ...m,
            camera_name: cam?.name || m.camera_id,
            latitude: cam?.location?.latitude ?? null,
            longitude: cam?.location?.longitude ?? null,
          }
        })
        setPersonMatches(enriched)
      }
    } catch (err) {
      setPersonError(err.message || 'Person search failed.')
    } finally {
      setPersonLoading(false)
    }
  }

  const routePoints = (result?.points || []).filter((p) => p.latitude && p.longitude)
  const hasLast = result?.last_latitude && result?.last_longitude
  const personPoints = (personMatches || []).filter((p) => p.latitude && p.longitude)

  let mapCenter = [22.2587, 71.1924]
  let mapZoom = 7
  if (mode === 'vehicle' && hasLast) {
    mapCenter = [result.last_latitude, result.last_longitude]
    mapZoom = 12
  } else if (mode === 'person' && personPoints.length > 0) {
    mapCenter = [personPoints[0].latitude, personPoints[0].longitude]
    mapZoom = 12
  }

  return (
    <div className="track-page">
      <div className="track-panel">
        <div className="track-mode-switch">
          <button className={mode === 'vehicle' ? 'active' : ''} onClick={() => setMode('vehicle')}>
            Track Vehicle
          </button>
          <button className={mode === 'person' ? 'active' : ''} onClick={() => setMode('person')}>
            Search Person
          </button>
        </div>

        {mode === 'vehicle' && (
          <>
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
          </>
        )}

        {mode === 'person' && (
          <>
            <h3>Search by photo</h3>
            <p className="hint">Upload a reference photo — matched against every face ever detected across all cameras.</p>
            <form onSubmit={handlePersonSearch} className="track-form person-search-form">
              <input type="file" accept="image/*" onChange={handlePersonFileChange} />
              <button type="submit" disabled={personLoading}>{personLoading ? 'Searching…' : 'Search'}</button>
            </form>
            {personPreviewUrl && (
              <img src={personPreviewUrl} alt="Reference preview" className="person-preview" />
            )}
            {personError && <p className="form-error">{personError}</p>}

            {personMatches && (
              <div className="track-table-wrap">
                <table className="track-table">
                  <thead>
                    <tr>
                      <th>Camera</th><th>When</th><th>Similarity</th><th>Crop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personMatches.map((m) => (
                      <tr key={m.event_id}>
                        <td>{m.camera_name}</td>
                        <td>{new Date(m.detected_at).toLocaleString()}</td>
                        <td>{(m.similarity_score * 100).toFixed(0)}%</td>
                        <td>{m.crop_image_path ? <a href={m.crop_image_path} target="_blank" rel="noreferrer">View</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="track-map">
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors'
                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {mode === 'vehicle' && routePoints.map((p) => (
            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={trackPointIcon()}>
              <Popup>
                <strong>{p.camera_name || p.camera_id}</strong><br />
                {p.event_type} — {new Date(p.created_at).toLocaleString()}
              </Popup>
            </Marker>
          ))}
          {mode === 'vehicle' && routePoints.length > 1 && (
            <Polyline positions={routePoints.map((p) => [p.latitude, p.longitude])}
                      pathOptions={{ color: '#0b3d66', weight: 3, dashArray: '6 6' }} />
          )}
          {mode === 'vehicle' && hasLast && (
            <Marker position={[result.last_latitude, result.last_longitude]} icon={lastKnownIcon()}>
              <Popup>
                <strong>Last known location</strong><br />
                {result.last_camera_id}<br />
                {new Date(result.last_seen).toLocaleString()}
              </Popup>
            </Marker>
          )}

          {mode === 'person' && personPoints.map((m) => (
            <Marker key={m.event_id} position={[m.latitude, m.longitude]} icon={personMatchIcon()}>
              <Popup>
                <strong>{m.camera_name}</strong><br />
                {new Date(m.detected_at).toLocaleString()}<br />
                Similarity: {(m.similarity_score * 100).toFixed(0)}%
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}