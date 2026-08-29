import { useState } from 'react'
import { createCamera, uploadCsv, uploadCamerasJson, resetCameras } from './api'

const DEPARTMENTS = ['Home', 'RTO', 'Food & Civil Supplies', 'Municipal Corporation', 'Traffic Police']

const EMPTY_FORM = {
  camera_id: '', organization_id: '', organization_name: '', name: '',
  department: DEPARTMENTS[0], district: '', latitude: '', longitude: '', address: '',
  camera_type: 'IP', codec: 'H264', width: 1920, height: 1080,
  rtsp: '', webrtc: '', hls: '', status: 'online',
}

export default function CameraOnboard({ onChange }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateField(field, value) {
    setForm({ ...form, [field]: value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.camera_id || !form.organization_id || !form.name || !form.latitude || !form.longitude) {
      setError('camera_id, organization_id, name, latitude and longitude are required.')
      return
    }
    setSubmitting(true)
    try {
      await createCamera({
        camera_id: form.camera_id,
        organization_id: form.organization_id,
        organization_name: form.organization_name || null,
        name: form.name,
        status: form.status,
        location: {
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          address: form.address || null,
        },
        camera_type: form.camera_type,
        properties: {
          codec: form.codec || null,
          width: form.width ? parseInt(form.width, 10) : null,
          height: form.height ? parseInt(form.height, 10) : null,
        },
        stream: {
          rtsp: form.rtsp || null,
          webrtc: form.webrtc || null,
          hls: form.hls || null,
        },
        department: form.department,
        district: form.district || null,
      })
      setForm(EMPTY_FORM)
      setMessage(`Added ${form.camera_id}.`)
      onChange()
    } catch (err) {
      setError('Could not add camera — check the camera_id is unique.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const result = await uploadCsv(file)
    setMessage(`CSV import: ${result.created} created, ${result.skipped_existing} skipped.`)
    onChange()
  }

  async function handleJsonUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const result = await uploadCamerasJson(file)
      setMessage(`JSON import: ${result.created} created, ${result.skipped_existing} skipped.`)
      onChange()
    } catch (err) {
      setMessage('JSON import failed — check the file matches the { "cameras": [...] } shape.')
    }
  }

  async function handleReset() {
    if (!confirm('Remove all cameras from the registry?')) return
    const result = await resetCameras()
    setMessage(`Cleared ${result.deleted_count} cameras.`)
    onChange()
  }

  return (
    <div className="onboard-panel">
      <h2>Camera Onboarding</h2>

      <div className="onboard-grid">
        <form className="add-camera-form" onSubmit={handleSubmit}>
          <h3>Manual entry</h3>
          <input placeholder="Camera ID (e.g. CAM-099)" value={form.camera_id}
                 onChange={(e) => updateField('camera_id', e.target.value)} />
          <input placeholder="Organization ID (e.g. ORG-POLICE)" value={form.organization_id}
                 onChange={(e) => updateField('organization_id', e.target.value)} />
          <input placeholder="Organization name" value={form.organization_name}
                 onChange={(e) => updateField('organization_name', e.target.value)} />
          <input placeholder="Camera name" value={form.name}
                 onChange={(e) => updateField('name', e.target.value)} />
          <select value={form.department} onChange={(e) => updateField('department', e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input placeholder="District" value={form.district}
                 onChange={(e) => updateField('district', e.target.value)} />
          <div className="row">
            <input placeholder="Latitude" value={form.latitude}
                   onChange={(e) => updateField('latitude', e.target.value)} />
            <input placeholder="Longitude" value={form.longitude}
                   onChange={(e) => updateField('longitude', e.target.value)} />
          </div>
          <input placeholder="Address" value={form.address}
                 onChange={(e) => updateField('address', e.target.value)} />

          <h3>Stream (webrtc preferred)</h3>
          <input placeholder="WebRTC URL" value={form.webrtc}
                 onChange={(e) => updateField('webrtc', e.target.value)} />
          <input placeholder="RTSP URL (optional)" value={form.rtsp}
                 onChange={(e) => updateField('rtsp', e.target.value)} />
          <input placeholder="HLS URL (optional)" value={form.hls}
                 onChange={(e) => updateField('hls', e.target.value)} />

          <select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
            <option value="online">Online</option>
            <option value="maintenance">Maintenance</option>
            <option value="offline">Offline</option>
          </select>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add camera'}</button>
        </form>

        <div className="bulk-panel">
          <h3>Bulk import — JSON</h3>
          <p className="hint">Upload a file matching {'{'} "cameras": [...] {'}'} exactly.</p>
          <input type="file" accept=".json" onChange={handleJsonUpload} />

          <h3 style={{ marginTop: 18 }}>Bulk import — CSV</h3>
          <p className="hint">Flat columns: camera_id, organization_id, name, latitude, longitude, department, district...</p>
          <input type="file" accept=".csv" onChange={handleCsvUpload} />

          <button className="reset-btn" onClick={handleReset}>Reset all camera data</button>
        </div>
      </div>

      {message && <p className="msg">{message}</p>}
    </div>
  )
}
