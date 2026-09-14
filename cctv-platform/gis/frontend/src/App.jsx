import { useState } from 'react'
import Dashboard from './Dashboard'
import MapView from './MapView'
import LiveView from './LiveView'
import AdminPanel from './AdminPanel'
import Login from './Login'
import { getCurrentUser, logout } from './api'

export default function App() {
  const [user, setUser] = useState(getCurrentUser())
  const [tab, setTab] = useState('dashboard')
  const [focusAlert, setFocusAlert] = useState(null)

  // Search results from the Track Vehicle / Search Person screen (LiveView),
  // handed to MapView so it can highlight the cameras that saw the target
  // and draw the vehicle's route. Shape: array of
  // { camera_id, timestamp, label, source: 'vehicle' | 'person' }
  const [trackedEvents, setTrackedEvents] = useState([])

  if (!user) {
    return <Login onLogin={setUser} />
  }

  function handleLogout() {
    logout()
    setUser(null)
    setTab('dashboard')
    setFocusAlert(null)
    setTrackedEvents([])
  }

  function handleFocusAlert(alert) {
    setFocusAlert(alert)
    setTab('map')
  }

  // Called by LiveView once a vehicle track / person search comes back with
  // results. Switches straight to Map View so the person doesn't have to
  // manually go find it — the whole point is "search here, see it lit up
  // on the map right away".
  function handleTrackResult(events) {
    setTrackedEvents(events || [])
    setTab('map')
  }

  function clearTrackedEvents() {
    setTrackedEvents([])
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
            <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
          )}
          <button onClick={handleLogout}>Log out</button>
        </nav>
      </header>

      {tab === 'dashboard' && <Dashboard onFocusAlert={handleFocusAlert} />}
      {tab === 'track' && <LiveView onTrackResult={handleTrackResult} />}
      {tab === 'map' && (
        <MapView
          user={user}
          focusAlert={focusAlert}
          trackedEvents={trackedEvents}
          onClearTracked={clearTrackedEvents}
        />
      )}
      {tab === 'admin' && isAdmin && <AdminPanel />}
    </div>
  )
}