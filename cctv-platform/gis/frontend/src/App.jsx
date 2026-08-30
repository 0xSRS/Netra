import { useState } from 'react'
import Dashboard from './Dashboard'
import MapView from './MapView'
import LiveView from './LiveView'
import CameraOnboard from './CameraOnboard'
import AdminPanel from './AdminPanel'
import Login from './Login'
import { getCurrentUser, logout } from './api'

export default function App() {
  const [user, setUser] = useState(getCurrentUser())
  const [tab, setTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  if (!user) {
    return <Login onLogin={setUser} />
  }

  function handleLogout() {
    logout()
    setUser(null)
    setTab('dashboard')
  }

  function handleRegistryChange() {
    setRefreshKey((k) => k + 1)
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
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={tab === 'track' ? 'active' : ''} onClick={() => setTab('track')}>Track Vehicle</button>
          <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Map View</button>
          {isAdmin && (
            <button className={tab === 'onboard' ? 'active' : ''} onClick={() => setTab('onboard')}>Onboard Cameras</button>
          )}
          {isAdmin && (
            <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
          )}
          <button onClick={handleLogout}>Log out</button>
        </nav>
      </header>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'track' && <LiveView />}
      {tab === 'map' && <MapView refreshKey={refreshKey} user={user} />}
      {tab === 'onboard' && isAdmin && <CameraOnboard onChange={handleRegistryChange} />}
      {tab === 'admin' && isAdmin && <AdminPanel />}
    </div>
  )
}