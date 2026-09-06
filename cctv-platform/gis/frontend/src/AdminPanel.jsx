import { useEffect, useState } from 'react'
import {
  fetchUsers, createUser, deleteUser,
  fetchWantedVehicles, addWantedVehicle, removeWantedVehicle,
  fetchMissingVehicles, addMissingVehicle, removeMissingVehicle,
} from './api'

const DEPARTMENTS = ['Home', 'RTO', 'Food & Civil Supplies', 'Municipal Corporation', 'Traffic Police']

const EMPTY_FORM = { username: '', password: '', department: DEPARTMENTS[0], role: 'viewer' }
const EMPTY_WANTED = { plate_number: '', fir_number: '', crime_description: '', severity: 'HIGH', issuing_authority: 'Gujarat Police' }
const EMPTY_MISSING = { plate_number: '', owner_name: '', vehicle_model: '', report_number: '', contact_number: '' }

function UsersTab() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadUsers() {
    try {
      setUsers(await fetchUsers())
    } catch (err) {
      setError('Could not load users.')
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function updateField(field, value) {
    setForm({ ...form, [field]: value })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!form.username || !form.password) {
      setError('Username and password are required.')
      return
    }
    try {
      await createUser({
        ...form,
        department: form.role === 'admin' ? null : form.department,
      })
      setMessage(`Created user "${form.username}".`)
      setForm(EMPTY_FORM)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(username) {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await deleteUser(username)
      setMessage(`Deleted "${username}".`)
      loadUsers()
    } catch (err) {
      setError('Could not delete that user.')
    }
  }

  return (
    <div className="onboard-grid">
      <form className="add-camera-form" onSubmit={handleCreate}>
        <h3>Create user</h3>
        <input placeholder="Username" value={form.username}
               onChange={(e) => updateField('username', e.target.value)} />
        <input type="password" placeholder="Password" value={form.password}
               onChange={(e) => updateField('password', e.target.value)} />
        <select value={form.role} onChange={(e) => updateField('role', e.target.value)}>
          <option value="viewer">Viewer (department-scoped)</option>
          <option value="operator">Operator (department-scoped)</option>
          <option value="admin">Admin (sees everything)</option>
        </select>
        {form.role !== 'admin' && (
          <select value={form.department} onChange={(e) => updateField('department', e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {error && <p className="form-error">{error}</p>}
        <button type="submit">Create user</button>
      </form>

      <div className="bulk-panel" style={{ flex: 1, minWidth: 320 }}>
        <h3>Existing users</h3>
        <table className="users-table">
          <thead>
            <tr><th>Username</th><th>Role</th><th>Department</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username}>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>{u.department || '—'}</td>
                <td>
                  <button className="reset-btn" style={{ width: 'auto', padding: '4px 10px' }}
                          onClick={() => handleDelete(u.username)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <p className="msg">{message}</p>}
    </div>
  )
}

function WatchlistTab() {
  const [wanted, setWanted] = useState([])
  const [missing, setMissing] = useState([])
  const [wantedForm, setWantedForm] = useState(EMPTY_WANTED)
  const [missingForm, setMissingForm] = useState(EMPTY_MISSING)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadLists() {
    try {
      const [w, m] = await Promise.all([fetchWantedVehicles(), fetchMissingVehicles()])
      setWanted(w)
      setMissing(m)
    } catch (err) {
      setError('Could not load watchlists.')
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  async function handleAddWanted(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!wantedForm.plate_number || !wantedForm.crime_description) {
      setError('Plate number and crime description are required.')
      return
    }
    try {
      await addWantedVehicle(wantedForm)
      setMessage(`Added ${wantedForm.plate_number} to wanted list.`)
      setWantedForm(EMPTY_WANTED)
      loadLists()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddMissing(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!missingForm.plate_number) {
      setError('Plate number is required.')
      return
    }
    try {
      await addMissingVehicle(missingForm)
      setMessage(`Added ${missingForm.plate_number} to missing list.`)
      setMissingForm(EMPTY_MISSING)
      loadLists()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveWanted(plate) {
    if (!confirm(`Remove ${plate} from the wanted list?`)) return
    try {
      await removeWantedVehicle(plate)
      loadLists()
    } catch (err) {
      setError('Could not remove that entry.')
    }
  }

  async function handleRemoveMissing(plate) {
    if (!confirm(`Remove ${plate} from the missing list?`)) return
    try {
      await removeMissingVehicle(plate)
      loadLists()
    } catch (err) {
      setError('Could not remove that entry.')
    }
  }

  return (
    <div>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="msg">{message}</p>}

      <div className="onboard-grid">
        <form className="add-camera-form" onSubmit={handleAddWanted}>
          <h3>Add wanted vehicle</h3>
          <input placeholder="Plate number" value={wantedForm.plate_number}
                 onChange={(e) => setWantedForm({ ...wantedForm, plate_number: e.target.value })} />
          <input placeholder="FIR number" value={wantedForm.fir_number}
                 onChange={(e) => setWantedForm({ ...wantedForm, fir_number: e.target.value })} />
          <input placeholder="Crime description" value={wantedForm.crime_description}
                 onChange={(e) => setWantedForm({ ...wantedForm, crime_description: e.target.value })} />
          <select value={wantedForm.severity}
                  onChange={(e) => setWantedForm({ ...wantedForm, severity: e.target.value })}>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <input placeholder="Issuing authority" value={wantedForm.issuing_authority}
                 onChange={(e) => setWantedForm({ ...wantedForm, issuing_authority: e.target.value })} />
          <button type="submit">Add to wanted list</button>
        </form>

        <div className="bulk-panel" style={{ flex: 1, minWidth: 320 }}>
          <h3>Wanted vehicles ({wanted.length})</h3>
          <table className="users-table">
            <thead>
              <tr><th>Plate</th><th>Severity</th><th>Crime</th><th></th></tr>
            </thead>
            <tbody>
              {wanted.map((w) => (
                <tr key={w.plate_number}>
                  <td>{w.plate_number}</td>
                  <td>{w.severity}</td>
                  <td>{w.crime_description}</td>
                  <td>
                    <button className="reset-btn" style={{ width: 'auto', padding: '4px 10px' }}
                            onClick={() => handleRemoveWanted(w.plate_number)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="onboard-grid" style={{ marginTop: 24 }}>
        <form className="add-camera-form" onSubmit={handleAddMissing}>
          <h3>Add missing vehicle</h3>
          <input placeholder="Plate number" value={missingForm.plate_number}
                 onChange={(e) => setMissingForm({ ...missingForm, plate_number: e.target.value })} />
          <input placeholder="Owner name" value={missingForm.owner_name}
                 onChange={(e) => setMissingForm({ ...missingForm, owner_name: e.target.value })} />
          <input placeholder="Vehicle model" value={missingForm.vehicle_model}
                 onChange={(e) => setMissingForm({ ...missingForm, vehicle_model: e.target.value })} />
          <input placeholder="Report number" value={missingForm.report_number}
                 onChange={(e) => setMissingForm({ ...missingForm, report_number: e.target.value })} />
          <input placeholder="Contact number" value={missingForm.contact_number}
                 onChange={(e) => setMissingForm({ ...missingForm, contact_number: e.target.value })} />
          <button type="submit">Add to missing list</button>
        </form>

        <div className="bulk-panel" style={{ flex: 1, minWidth: 320 }}>
          <h3>Missing vehicles ({missing.length})</h3>
          <table className="users-table">
            <thead>
              <tr><th>Plate</th><th>Owner</th><th>Model</th><th></th></tr>
            </thead>
            <tbody>
              {missing.map((m) => (
                <tr key={m.plate_number}>
                  <td>{m.plate_number}</td>
                  <td>{m.owner_name || '—'}</td>
                  <td>{m.vehicle_model || '—'}</td>
                  <td>
                    <button className="reset-btn" style={{ width: 'auto', padding: '4px 10px' }}
                            onClick={() => handleRemoveMissing(m.plate_number)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const [section, setSection] = useState('users') // 'users' | 'watchlist'

  return (
    <div className="onboard-panel">
      <h2>Admin</h2>
      <div className="track-mode-switch">
        <button className={section === 'users' ? 'active' : ''} onClick={() => setSection('users')}>
          User Management
        </button>
        <button className={section === 'watchlist' ? 'active' : ''} onClick={() => setSection('watchlist')}>
          Vehicle Watchlist
        </button>
      </div>

      {section === 'users' && <UsersTab />}
      {section === 'watchlist' && <WatchlistTab />}
    </div>
  )
}