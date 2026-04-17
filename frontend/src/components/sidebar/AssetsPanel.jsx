import { useEffect, useState, useRef } from 'react'
import { subscribeAssets, uploadAsset, deleteAsset } from '../../lib/room'

const MAX_SIZE_BYTES = 400_000  // 400KB — Firestore doc limit is 1MB, base64 adds ~33%

export default function AssetsPanel({ roomId, onInsert }) {
  const [assets, setAssets]       = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const unsub = subscribeAssets(roomId, setAssets)
    return unsub
  }, [roomId])

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploadErr(null)
    setUploading(true)

    for (const file of files) {
      if (file.size > MAX_SIZE_BYTES) {
        setUploadErr(`"${file.name}" is too large (${(file.size/1024).toFixed(0)}KB). Max is 400KB. Please resize the image first.`)
        continue
      }
      try {
        const base64 = await toBase64(file)
        await uploadAsset(roomId, file.name, base64, file.type)
      } catch (err) {
        setUploadErr(`Upload failed: ${err.message}`)
      }
    }

    setUploading(false)
    e.target.value = ''
  }

  const handleInsert = (asset) => {
    const cmd = `\\includegraphics[width=0.8\\textwidth]{${asset.name}}`
    onInsert(cmd)
  }

  const handleCopy = (asset) => {
    const cmd = `\\includegraphics[width=0.8\\textwidth]{${asset.name}}`
    navigator.clipboard.writeText(cmd)
  }

  const handleDelete = async (assetId) => {
    if (!confirm('Delete this asset?')) return
    await deleteAsset(roomId, assetId)
  }

  return (
    <div className="assets-panel">
      <div className="file-tree-header">
        <span>ASSETS</span>
        <button
          className="file-tree-add"
          onClick={() => inputRef.current?.click()}
          title="Upload image (max 400KB)"
          disabled={uploading}
        >
          {uploading ? '⏳' : '↑'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {uploadErr && (
        <div className="asset-error">
          ⚠ {uploadErr}
          <button className="asset-error-close" onClick={() => setUploadErr(null)}>✕</button>
        </div>
      )}

      {assets.length === 0 && !uploadErr && (
        <p className="assets-empty">
          Upload PNG/JPG images (max 400KB each).<br />
          Click Insert to add <code>\includegraphics</code> at cursor.
        </p>
      )}

      <div className="assets-grid">
        {assets.map((a) => (
          <div key={a.id} className="asset-item" title={a.name}>
            <img
              src={`data:${a.mimeType};base64,${a.base64}`}
              alt={a.name}
              className="asset-thumb"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <span className="asset-name">{a.name}</span>
            <div className="asset-actions">
              <button className="asset-btn" onClick={() => handleInsert(a)} title="Insert at cursor">
                Insert
              </button>
              <button className="asset-btn" onClick={() => handleCopy(a)} title="Copy command">
                Copy
              </button>
              <button className="asset-btn asset-btn--delete" onClick={() => handleDelete(a.id)}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
