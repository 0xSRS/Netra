import { useEffect, useState } from 'react'
import { fetchUsers, createUser, deleteUser } from './api'

const DEPARTMENTS = ['Home', 'RTO', 'Food & Civil Supplies', 'Municipal Corporation', 'Traffic Police']

const EMPTY_FORM = { username: '', password: '', department: DEPARTMENTS[0], role: 'viewer' }

export default function AdminPanel() {
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
    <div className="onboard-panel">
      <h2>Admin — User Management</h2>

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
      </div>

      {message && <p className="msg">{message}</p>}
    </div>
  )
}
