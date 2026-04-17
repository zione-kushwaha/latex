import { useEffect, useState } from 'react'
import { SYNC } from '../hooks/useRoom'

const WARN_AT  = 700_000
const BLOCK_AT = 900_000

function sizeLabel(len) {
  if (len < 1000) return `${len} B`
  if (len < 1_000_000) return `${(len / 1000).toFixed(1)} KB`
  return `${(len / 1_000_000).toFixed(2)} MB`
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

// Sync indicator config
const SYNC_CONFIG = {
  idle:    { icon: '✓',  label: 'Synced',  color: 'var(--success)' },
  typing:  { icon: '✎',  label: 'Typing…', color: 'var(--text-muted)' },
  saving:  { icon: '↑',  label: 'Saving…', color: '#f59e0b' },
  saved:   { icon: '✓',  label: 'Saved',   color: 'var(--success)' },
  error:   { icon: '✕',  label: 'Save failed', color: 'var(--danger)' },
}

export default function StatusBar({ currentUser, userCount, contentLength = 0, localMode, activeFileId, dirtyFiles }) {
  const [syncState, setSyncState] = useState('idle')
  const [errorMsg, setErrorMsg]   = useState(null)
  const [cursor, setCursor]       = useState({ line: 1, col: 1 })

  useEffect(() => {
    let idleTimer = null

    const onTyping  = () => { setSyncState('typing'); setErrorMsg(null) }
    const onSaving  = () => setSyncState('saving')
    const onSaved   = () => {
      setSyncState('saved')
      // Return to idle after 2s
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => setSyncState('idle'), 2000)
    }
    const onError   = (e) => {
      setSyncState('error')
      setErrorMsg(e.detail?.msg || 'Unknown error')
    }

    const onCursorMove = (e) => setCursor(e.detail)

    window.addEventListener(SYNC.TYPING,  onTyping)
    window.addEventListener(SYNC.SAVING,  onSaving)
    window.addEventListener(SYNC.SAVED,   onSaved)
    window.addEventListener(SYNC.ERROR,   onError)
    window.addEventListener('tlc:cursor', onCursorMove)

    return () => {
      clearTimeout(idleTimer)
      window.removeEventListener(SYNC.TYPING,  onTyping)
      window.removeEventListener(SYNC.SAVING,  onSaving)
      window.removeEventListener(SYNC.SAVED,   onSaved)
      window.removeEventListener(SYNC.ERROR,   onError)
      window.removeEventListener('tlc:cursor', onCursorMove)
    }
  }, [])

  const isDirty  = dirtyFiles?.has(activeFileId)
  const cfg      = SYNC_CONFIG[syncState]
  const isWarn   = contentLength >= WARN_AT
  const isBlock  = contentLength >= BLOCK_AT

  const [words, setWords] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWords(wordCount(window.__tlc_content__ || '')), 300)
    return () => clearTimeout(t)
  }, [contentLength])

  return (
    <div className="status-bar">
      {/* Current user */}
      <span className="status-user" style={{ color: currentUser.color }}>
        ● {currentUser.name}
      </span>

      <span className="status-sep">|</span>
      <span>{userCount}/4 online</span>
      <span className="status-sep">|</span>

      {/* Local mode badge */}
      {localMode && (
        <span className="status-local-badge" title="Local mode — changes not synced yet">
          ⬡ LOCAL
        </span>
      )}
      {isDirty && !localMode && (
        <span className="status-dirty" title="Unpushed changes in this file">● unsaved</span>
      )}
      {(localMode || isDirty) && <span className="status-sep">|</span>}

      {/* Live sync indicator */}
      <span
        className={`status-sync ${syncState === 'saving' ? 'status-sync--pulse' : ''}`}
        style={{ color: cfg.color }}
        title={errorMsg || cfg.label}
      >
        {cfg.icon} {cfg.label}
        {syncState === 'error' && errorMsg && (
          <span style={{ fontSize: 10, marginLeft: 4 }}>({errorMsg})</span>
        )}
      </span>

      <span className="status-sep">|</span>

      {/* Cursor position */}
      <span title="Line : Column">Ln {cursor.line}, Col {cursor.col}</span>

      <span className="status-sep">|</span>

      {/* Word count */}
      <span title="Word count">{words} words</span>

      <span className="status-sep">|</span>

      {/* Document size */}
      <span style={{
        color: isBlock ? 'var(--danger)' : isWarn ? '#f59e0b' : 'var(--text-muted)',
        fontWeight: isWarn ? 700 : 400,
      }}>
        {sizeLabel(contentLength)}
        {isBlock && ' ⛔ limit'}
        {isWarn && !isBlock && ' ⚠'}
      </span>
    </div>
  )
}
