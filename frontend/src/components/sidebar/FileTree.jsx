import { useState } from 'react'
import { createFile, deleteFile, renameFile } from '../../lib/room'

function FileIcon({ name }) {
  if (name === 'main.tex') return <span>🏠</span>
  return <span>📄</span>
}

function FolderIcon({ open }) {
  return <span>{open ? '📂' : '📁'}</span>
}

export default function FileTree({ roomId, files, activeFileId, onSelect }) {
  const [newFileName, setNewFileName] = useState('')
  const [newFolder, setNewFolder]     = useState('')
  const [showNew, setShowNew]         = useState(false)
  const [renaming, setRenaming]       = useState(null) // fileId being renamed
  const [renameVal, setRenameVal]     = useState('')
  const [openFolders, setOpenFolders] = useState({ sections: true })

  // Group files by folder
  const grouped = {}
  const rootFiles = []
  Object.values(files).forEach((f) => {
    if (f.folder) {
      if (!grouped[f.folder]) grouped[f.folder] = []
      grouped[f.folder].push(f)
    } else {
      rootFiles.push(f)
    }
  })

  // Sort: main.tex first, then alphabetical
  const sortFiles = (arr) => [...arr].sort((a, b) => {
    if (a.name === 'main.tex') return -1
    if (b.name === 'main.tex') return 1
    return a.name.localeCompare(b.name)
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newFileName.trim()) return
    const id = await createFile(roomId, newFileName.trim(), newFolder || null)
    setNewFileName('')
    setNewFolder('')
    setShowNew(false)
    onSelect(id)
  }

  const handleDelete = async (e, fileId) => {
    e.stopPropagation()
    if (fileId === 'main') return
    if (!confirm(`Delete ${files[fileId]?.name}?`)) return
    await deleteFile(roomId, fileId)
    if (activeFileId === fileId) onSelect('main')
  }

  const handleRename = async (e, fileId) => {
    e.preventDefault()
    if (!renameVal.trim()) { setRenaming(null); return }
    await renameFile(roomId, fileId, renameVal.trim())
    setRenaming(null)
  }

  const toggleFolder = (folder) =>
    setOpenFolders((p) => ({ ...p, [folder]: !p[folder] }))

  const renderFile = (f) => {
    const isActive  = f.id === activeFileId
    const isEditing = f.editingBy && f.editingBy.id !== undefined

    return (
      <div
        key={f.id}
        className={`file-item ${isActive ? 'file-item--active' : ''}`}
        onClick={() => onSelect(f.id)}
      >
        {renaming === f.id ? (
          <form onSubmit={(e) => handleRename(e, f.id)} className="rename-form">
            <input
              autoFocus
              className="rename-input"
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onBlur={() => setRenaming(null)}
            />
          </form>
        ) : (
          <>
            <FileIcon name={f.name} />
            <span className="file-name">{f.name}</span>
            {isEditing && (
              <span
                className="file-editing-dot"
                style={{ background: f.editingBy.color }}
                title={`${f.editingBy.name} is editing`}
              />
            )}
            {f.id !== 'main' && (
              <div className="file-actions">
                <button
                  className="file-action-btn"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenaming(f.id)
                    setRenameVal(f.name)
                  }}
                >✏️</button>
                <button
                  className="file-action-btn file-action-btn--delete"
                  title="Delete"
                  onClick={(e) => handleDelete(e, f.id)}
                >🗑</button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>FILES</span>
        <button className="file-tree-add" onClick={() => setShowNew((v) => !v)} title="New file">+</button>
      </div>

      {/* Root files (main.tex etc) */}
      {sortFiles(rootFiles).map(renderFile)}

      {/* Folders */}
      {Object.entries(grouped).sort().map(([folder, folderFiles]) => (
        <div key={folder} className="folder-group">
          <div className="folder-header" onClick={() => toggleFolder(folder)}>
            <FolderIcon open={openFolders[folder]} />
            <span className="folder-name">{folder}</span>
          </div>
          {openFolders[folder] && (
            <div className="folder-children">
              {sortFiles(folderFiles).map(renderFile)}
            </div>
          )}
        </div>
      ))}

      {/* New file form */}
      {showNew && (
        <form onSubmit={handleCreate} className="new-file-form">
          <input
            autoFocus
            className="new-file-input"
            placeholder="filename.tex"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
          />
          <input
            className="new-file-input"
            placeholder="folder (optional)"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
          />
          <div className="new-file-actions">
            <button className="btn btn-primary" type="submit" style={{ fontSize: 11, padding: '4px 10px' }}>Create</button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowNew(false)} style={{ fontSize: 11, padding: '4px 10px' }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
