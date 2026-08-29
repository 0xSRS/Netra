import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { fetchCameras, fetchGapAnalysis } from './api'

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

export default function MapView({ refreshKey, trackedRoute, user }) {
  const [cameras, setCameras] = useState([])
  const [gap, setGap] = useState(null)
  const [filters, setFilters] = useState({ department: '', district: '', status: '', search: '' })
  const [showGap, setShowGap] = useState(false)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchCameras(filters).then(setCameras)
  }, [filters, refreshKey])

  async function loadGap() {
    setGap(await fetchGapAnalysis())
  }

  const departments = [...new Set(cameras.map((c) => c.department).filter(Boolean))]
  const districts = [...new Set(cameras.map((c) => c.district).filter(Boolean))]

  // Draw the tracked vehicle's route by connecting the camera locations it
  // was seen at, in order — trackedRoute comes from LiveView's vehicle search.
  const routeLatLngs = (trackedRoute || [])
    .map((event) => {
      const cam = cameras.find((c) => c.camera_id === event.camera_id)
      return cam ? [cam.location.latitude, cam.location.longitude] : null
    })
    .filter(Boolean)

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
          {cameras.map((cam) => (
            <Marker key={cam.camera_id} position={[cam.location.latitude, cam.location.longitude]}
                    icon={coloredIcon(cam.status)}>
              <Popup>
                <strong>{cam.camera_id}</strong> — {cam.name}<br />
                {cam.organization_name || cam.organization_id}<br />
                {cam.location.address && <>{cam.location.address}<br /></>}
                Status: {cam.status}<br />
                {cam.properties?.width && cam.properties?.height &&
                  <>Resolution: {cam.properties.width}×{cam.properties.height}<br /></>}
                {cam.stream?.webrtc && (
                  <a href={cam.stream.webrtc} target="_blank" rel="noreferrer">
                    Open live view (WebRTC)
                  </a>
                )}
              </Popup>
            </Marker>
          ))}
          {routeLatLngs.length > 1 && (
            <Polyline positions={routeLatLngs} pathOptions={{ color: '#0b3d66', weight: 4 }} />
          )}
        </MapContainer>
      </main>
    </div>
  )
}
