import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { fetchCameras, fetchGapAnalysis, fetchVehicleAlerts, fetchPersonAlerts } from './api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLOR = { online: '#1a9e5c', active: '#1a9e5c', maintenance: '#e0a300', offline: '#c0392b', inactive: '#c0392b' }

function coloredIcon(status) {
  const color = STATUS_COLOR[status] || '#555'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.5)"></div>`,
    iconSize: [14, 14],
  })
}

// Alert markers get a distinct square badge so they never get mistaken for
// a plain camera dot, colored by severity.
const SEVERITY_COLOR = { HIGH: '#c0392b', MEDIUM: '#e0a300', LOW: '#3d6fa8' }

function alertIcon(source, severity) {
  const color = SEVERITY_COLOR[severity] || '#7a2e8f'
  const shape = source === 'vehicle' ? '3px' : '50%'  // vehicle = rounded square, person = circle
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:${shape};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.6)"></div>`,
    iconSize: [16, 16],
  })
}

// A camera that matched the current vehicle/person search gets its own
// unmistakable marker: bigger, gold ring, pulsing halo — so it's obvious at
// a glance which cameras "lit up" for this search, separate from the plain
// registry dots and from unrelated alert badges.
function highlightIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:28px;">
        <div class="tracked-pulse-ring"></div>
        <div style="position:absolute;top:6px;left:6px;background:#d4a017;width:16px;height:16px;
                    border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.7);"></div>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Recenters the map imperatively when App/Dashboard hands MapView a
// specific alert (or a fresh search) to focus on — MapContainer itself only
// takes an initial center/zoom, so a plain prop change won't move an
// already-mounted map.
function FocusHandler({ focusAlert, focusPoint }) {
  const map = useMap()
  useEffect(() => {
    if (focusAlert && focusAlert.latitude && focusAlert.longitude) {
      map.setView([focusAlert.latitude, focusAlert.longitude], 15)
    }
  }, [focusAlert, map])

  useEffect(() => {
    if (focusPoint && focusPoint.latitude != null && focusPoint.longitude != null) {
      map.setView([focusPoint.latitude, focusPoint.longitude], 13)
    }
  }, [focusPoint, map])

  return null
}

export default function MapView({ refreshKey, user, focusAlert, trackedEvents, onClearTracked }) {
  const [cameras, setCameras] = useState([])
  const [gap, setGap] = useState(null)
  const [filters, setFilters] = useState({ department: '', district: '', status: '', search: '' })
  const [showGap, setShowGap] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [showAlerts, setShowAlerts] = useState(true)
  const [alertFilter, setAlertFilter] = useState('all') // 'all' | 'vehicle' | 'person'
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchCameras(filters).then(setCameras)
  }, [filters, refreshKey])

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 15000) // keep the alert layer reasonably fresh
    return () => clearInterval(interval)
  }, [])

  async function loadAlerts() {
    try {
      const [vehicleAlerts, personAlerts] = await Promise.all([
        fetchVehicleAlerts(),
        fetchPersonAlerts(),
      ])
      const vMapped = vehicleAlerts.map((a) => ({
        source: 'vehicle',
        id: a.id,
        camera_id: a.camera_id,
        headline: `${a.alert_type} — ${a.plate_number || 'unknown plate'}`,
        details: a.details,
        severity: a.severity,
        timestamp: a.triggered_at,
      }))
      const pMapped = personAlerts.map((a) => ({
        source: 'person',
        id: a.alert_id,
        camera_id: a.camera_id,
        headline: `${a.category} person match (${Number(a.similarity_score || 0).toFixed(2)} similarity)`,
        details: null,
        severity: a.category === 'wanted' ? 'HIGH' : 'MEDIUM',
        timestamp: a.created_at,
      }))
      setAlerts([...vMapped, ...pMapped])
    } catch (err) {
      // Non-fatal — the map still works without the alert layer.
    }
  }

  async function loadGap() {
    setGap(await fetchGapAnalysis())
  }

  const departments = [...new Set(cameras.map((c) => c.department).filter(Boolean))]
  const districts = [...new Set(cameras.map((c) => c.district).filter(Boolean))]

  const events = trackedEvents || []

  // Group tracked events (vehicle sightings / person matches) by the camera
  // that produced them, so one camera seen 3 times shows one highlighted
  // marker with all 3 timestamps listed, not 3 overlapping markers.
  const eventsByCamera = {}
  for (const ev of events) {
    if (!ev.camera_id) continue
    if (!eventsByCamera[ev.camera_id]) eventsByCamera[ev.camera_id] = []
    eventsByCamera[ev.camera_id].push(ev)
  }
  const highlightedCameraIds = new Set(Object.keys(eventsByCamera))

  // Draw the tracked vehicle's route by connecting the camera locations it
  // was seen at, in chronological order — vehicle events only, person
  // sightings don't imply a "route" the way a moving vehicle's plate does.
  const vehicleEvents = events
    .filter((e) => e.source === 'vehicle' && e.latitude != null && e.longitude != null)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const routeLatLngs = vehicleEvents.map((e) => [e.latitude, e.longitude])

  // Focus the map on the first tracked event as soon as a fresh search
  // arrives (falls back to camera coords if the event itself has none).
  const firstEvent = events[0]
  const firstEventCam = firstEvent ? cameras.find((c) => c.camera_id === firstEvent.camera_id) : null
  const focusPoint = firstEvent
    ? {
        latitude: firstEvent.latitude ?? firstEventCam?.location?.latitude ?? null,
        longitude: firstEvent.longitude ?? firstEventCam?.location?.longitude ?? null,
      }
    : null

  // Join each alert to its camera's coordinates so it can be plotted; drop
  // alerts whose camera has no location or was filtered out of the user's view.
  const visibleAlerts = alerts
    .filter((a) => alertFilter === 'all' || a.source === alertFilter)
    .map((a) => {
      const cam = cameras.find((c) => c.camera_id === a.camera_id)
      if (!cam || cam.location.latitude == null || cam.location.longitude == null) return null
      return { ...a, latitude: cam.location.latitude, longitude: cam.location.longitude, camera_name: cam.name }
    })
    .filter(Boolean)

  const resolvedFocusAlert = focusAlert
    ? visibleAlerts.find((a) => a.source === focusAlert.source && String(a.id) === String(focusAlert.id))
    : null

  return (
    <div className="layout">
      <aside className="sidebar">
        <section>
          <h3>Filters</h3>
          {isAdmin && (
            <select onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select onChange={(e) => setFilters({ ...filters, district: e.target.value })}>
            <option value="">All districts</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="online">Online</option>
            <option value="maintenance">Maintenance</option>
            <option value="offline">Offline</option>
          </select>
          <input type="text" placeholder="Search camera ID or name"
                 onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </section>

        {events.length > 0 && (
          <section>
            <h3>Tracked search</h3>
            <p className="hint">
              {highlightedCameraIds.size} camera{highlightedCameraIds.size === 1 ? '' : 's'} lit up
              {' '}for this search — gold markers below.
            </p>
            <ul className="tracked-list">
              {Object.entries(eventsByCamera).map(([camId, evs]) => (
                <li key={camId}>
                  <strong>{camId}</strong>
                  <ul>
                    {evs.map((e, i) => (
                      <li key={i}>{e.label || e.source} — {new Date(e.timestamp).toLocaleString()}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {onClearTracked && (
              <button className="gap-btn" onClick={onClearTracked}>Clear tracked search</button>
            )}
          </section>
        )}

        <section>
          <h3>Alerts on map</h3>
          <label className="alert-toggle">
            <input type="checkbox" checked={showAlerts} onChange={(e) => setShowAlerts(e.target.checked)} />
            Show alerts ({visibleAlerts.length})
          </label>
          <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)}>
            <option value="all">Vehicle + Person</option>
            <option value="vehicle">Vehicle only</option>
            <option value="person">Person only</option>
          </select>
        </section>

        {isAdmin && (
          <section>
            <button className="gap-btn" onClick={() => { setShowGap(!showGap); if (!gap) loadGap() }}>
              {showGap ? 'Hide' : 'Show'} gap analysis
            </button>
            {showGap && gap && (
              <div className="gap-panel">
                <p><strong>Total cameras:</strong> {gap.total_cameras}</p>
                <p><strong>Per district:</strong></p>
                <ul>{gap.cameras_per_district.map((d) => <li key={d.district}>{d.district}: {d.count}</li>)}</ul>
                <p><strong>Flagged for attention:</strong> {gap.flagged_for_attention.length}</p>
                <ul>{gap.flagged_for_attention.map((c) => <li key={c.camera_id}>{c.camera_id} ({c.status})</li>)}</ul>
              </div>
            )}
          </section>
        )}
      </aside>

      <main className="map-area">
        <MapContainer center={[22.2587, 71.1924]} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors'
                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FocusHandler focusAlert={resolvedFocusAlert} focusPoint={focusPoint} />

          {cameras.map((cam) => {
            const isHighlighted = highlightedCameraIds.has(cam.camera_id)
            const camEvents = eventsByCamera[cam.camera_id] || []
            return (
              <Marker
                key={cam.camera_id}
                position={[cam.location.latitude, cam.location.longitude]}
                icon={isHighlighted ? highlightIcon() : coloredIcon(cam.status)}
                zIndexOffset={isHighlighted ? 1000 : 0}
              >
                <Popup>
                  <strong>{cam.camera_id}</strong> — {cam.name}<br />
                  {cam.organization_name || cam.organization_id}<br />
                  {cam.location.address && <>{cam.location.address}<br /></>}
                  {cam.location.isFallback && (
                    <span style={{ color: '#e0a300' }}>⚠ approximate location (no GPS from ingestion yet)<br /></span>
                  )}
                  Status: {cam.status}<br />
                  {cam.properties?.codec && <>Codec: {cam.properties.codec}<br /></>}
                  {cam.properties?.width && cam.properties?.height &&
                    <>Resolution: {cam.properties.width}×{cam.properties.height}<br /></>}
                  {cam.stream?.webrtc && (
                    <a href={cam.stream.webrtc} target="_blank" rel="noreferrer">
                      Open live view (WebRTC)
                    </a>
                  )}
                  {isHighlighted && (
                    <>
                      <hr />
                      <span style={{ color: '#a67c00' }}><strong>Matched this search:</strong></span>
                      <ul style={{ margin: '4px 0 0 -18px' }}>
                        {camEvents.map((e, i) => (
                          <li key={i}>{e.label || e.source} — {new Date(e.timestamp).toLocaleString()}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </Popup>
              </Marker>
            )
          })}

          {showAlerts && visibleAlerts.map((a) => (
            <Marker key={`${a.source}-${a.id}`} position={[a.latitude, a.longitude]}
                    icon={alertIcon(a.source, a.severity)}>
              <Popup>
                <span className={`alert-badge ${a.source}`}>{a.source}</span><br />
                <strong>{a.headline}</strong><br />
                {a.camera_name} ({a.camera_id})<br />
                {a.details && <>{a.details}<br /></>}
                {new Date(a.timestamp).toLocaleString()}
              </Popup>
            </Marker>
          ))}

          {routeLatLngs.length > 1 && (
            <Polyline positions={routeLatLngs} pathOptions={{ color: '#d4a017', weight: 4 }} />
          )}
        </MapContainer>
      </main>
    </div>
  )
}