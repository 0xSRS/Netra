import { useState } from 'react'
import { uploadCsv, uploadCamerasJson, resetCameras } from './api'

export default function CameraOnboard({ onChange }) {
  const [message, setMessage] = useState('')

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
      <p className="hint">Cameras arrive automatically from the ingestion pipeline's GLS sync. These tools are for manual bulk-import only if you ever need them.</p>

      <div className="onboard-grid">
        <div className="bulk-panel">
          <h3>Bulk import — JSON</h3>
          <input type="file" accept=".json" onChange={handleJsonUpload} />

          <h3 style={{ marginTop: 18 }}>Bulk import — CSV</h3>
          <input type="file" accept=".csv" onChange={handleCsvUpload} />

          <button className="reset-btn" onClick={handleReset}>Reset all camera data</button>
        </div>
      </div>

      {message && <p className="msg">{message}</p>}
    </div>
  )
}