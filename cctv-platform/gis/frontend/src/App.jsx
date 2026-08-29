import { useState } from 'react'
import MapView from './MapView'
import LiveView from './LiveView'
import CameraOnboard from './CameraOnboard'
import AdminPanel from './AdminPanel'
import Login from './Login'
import { getCurrentUser, logout } from './api'

export default function App() {
  const [user, setUser] = useState(getCurrentUser())
  const [tab, setTab] = useState('map')
  const [refreshKey, setRefreshKey] = useState(0)
  const [trackedRoute, setTrackedRoute] = useState(null)

  if (!user) {
    return <Login onLogin={setUser} />
  }

  function handleLogout() {
    logout()
    setUser(null)
    setTab('map')
  }

  function handleRegistryChange() {
    setRefreshKey((k) => k + 1)
  }

  function handleTrackResult(events) {
    setTrackedRoute(events)
    setTab('map')
  }

  const isAdmin = user.role === 'admin'

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Netra — Gujarat CCTV Platform</h1>
          <p className="subtitle">
            {isAdmin ? 'All departments' : user.department} — signed in as {user.username} ({user.role})
          </p>
        </div>
        <nav className="tabs">
          <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Map View</button>
          <button className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>Live View</button>
          {isAdmin && (
            <button className={tab === 'onboard' ? 'active' : ''} onClick={() => setTab('onboard')}>Onboard Cameras</button>
          )}
          {isAdmin && (
            <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
          )}
          <button onClick={handleLogout}>Log out</button>
        </nav>
      </header>

      {tab === 'map' && <MapView refreshKey={refreshKey} trackedRoute={trackedRoute} user={user} />}
      {tab === 'live' && <LiveView onTrackResult={handleTrackResult} />}
      {tab === 'onboard' && isAdmin && <CameraOnboard onChange={handleRegistryChange} />}
      {tab === 'admin' && isAdmin && <AdminPanel />}
    </div>
  )
}
