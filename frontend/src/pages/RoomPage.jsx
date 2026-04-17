import { useParams } from 'react-router-dom'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRoom } from '../hooks/useRoom'
import { useCompile } from '../hooks/useCompile'
import { subscribeAssets } from '../lib/room'
import LatexEditor from '../components/LatexEditor'
import PdfPreview from '../components/PdfPreview'
import Toolbar from '../components/Toolbar'
import UserList from '../components/UserList'
import StatusBar from '../components/StatusBar'
import SplitPane from '../components/SplitPane'
import FileTree from '../components/sidebar/FileTree'
import AssetsPanel from '../components/sidebar/AssetsPanel'
import OutlinePanel from '../components/sidebar/OutlinePanel'

const AUTO_COMPILE_DELAY = 2000

function buildLineMap(files) {
  const map = []
  const main = files['main']
  if (!main?.content) return map

  const processContent = (content, fileId) => {
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const inputMatch = lines[i].match(/^\\input\{([^}]+)\}/)
      if (inputMatch) {
        const path  = inputMatch[1]
        const fid   = path.replace(/\.tex$/, '').replace(/\//g, '__')
        const child = files[fid]
        if (child?.content) { processContent(child.content, fid); continue }
      }
      map.push({ fileId, localLine: i + 1 })
    }
  }

  processContent(main.content, 'main')
  return map
}

function mergeDocument(files) {
  const main = files['main']
  if (!main?.content) return ''
  return main.content.replace(/\\input\{([^}]+)\}/g, (_, path) => {
    const fileId = path.replace(/\.tex$/, '').replace(/\//g, '__')
    return files[fileId]?.content ?? `% File not found: ${path}`
  })
}

export default function RoomPage() {
  const { roomId } = useParams()
  const {
    files, users, activeFileId, activeFile, content,
    currentUser, error, joined,
    localMode, dirtyFiles,
    switchFile, handleContentChange, handleCursorChange,
    pushFile, pushAll, toggleLocalMode,
  } = useRoom(roomId)

  const { pdfUrl, compileError, compiling, elapsed, statusMsg, compile } = useCompile()
  const [autoCompile, setAutoCompile] = useState(false)
  const [sidebarTab, setSidebarTab]   = useState('files')

  // Jump to a specific file+line from the outline
  const handleOutlineJump = useCallback((line, fileId) => {
    if (fileId !== activeFileId) {
      switchFile(fileId)
      setTimeout(() => jumpToLineRef.current?.(line), 80)
    } else {
      jumpToLineRef.current?.(line)
    }
  }, [activeFileId, switchFile])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [assets, setAssets]           = useState([])
  const [fontSize, setFontSize]       = useState(14)
  const autoTimer     = useRef(null)
  const insertTextRef = useRef(null)
  const jumpToLineRef = useRef(null)

  // Expose content for StatusBar word count
  useEffect(() => { window.__tlc_content__ = content }, [content])

  // Ctrl+S → push current file when in local mode
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (localMode) pushFile(activeFileId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [localMode, pushFile, activeFileId])

  // Warn before closing tab when there are unpushed local changes
  useEffect(() => {
    const handler = (e) => {
      if (dirtyFiles.size > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtyFiles])

  const assetsRef = useRef(assets)
  useEffect(() => { assetsRef.current = assets }, [assets])

  useEffect(() => {
    if (!joined) return
    return subscribeAssets(roomId, setAssets)
  }, [roomId, joined])

  const filesReady = Boolean(files['main']?.content)

  useEffect(() => {
    if (!autoCompile || !filesReady) return
    const full = mergeDocument(files)
    if (!full) return
    clearTimeout(autoTimer.current)
    autoTimer.current = setTimeout(() => compile(full, assetsRef.current), AUTO_COMPILE_DELAY)
    return () => clearTimeout(autoTimer.current)
  }, [files, autoCompile, filesReady, compile])

  const handleCompile = useCallback(() => {
    const full = mergeDocument(files)
    if (full) compile(full, assetsRef.current)
  }, [files, compile])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleCompile() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCompile])

  const handleInsertAsset = useCallback((text) => { insertTextRef.current?.(text) }, [])

  const handleJumpToLine = useCallback((mergedLineNo) => {
    const map   = buildLineMap(files)
    const entry = map[mergedLineNo - 1]
    if (!entry) return
    if (entry.fileId !== activeFileId) {
      switchFile(entry.fileId)
      setTimeout(() => jumpToLineRef.current?.(entry.localLine), 80)
    } else {
      jumpToLineRef.current?.(entry.localLine)
    }
  }, [files, activeFileId, switchFile])

  if (error) {
    return (
      <div className="full-center">
        <div className="error-card">
          <h2>Cannot join room</h2>
          <p>{error}</p>
          <a href="/" className="btn btn-primary">← Back to Home</a>
        </div>
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="full-center">
        <div className="spinner" />
        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Joining room…</p>
      </div>
    )
  }

  if (!filesReady) {
    return (
      <div className="full-center">
        <div className="spinner" />
        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading files…</p>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Toolbar
        roomId={roomId}
        compiling={compiling}
        autoCompile={autoCompile}
        pdfUrl={pdfUrl}
        content={mergeDocument(files)}
        activeFileName={activeFile?.name ?? 'main.tex'}
        localMode={localMode}
        dirtyCount={dirtyFiles.size}
        fontSize={fontSize}
        onCompile={handleCompile}
        onToggleAutoCompile={() => setAutoCompile((v) => !v)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleLocalMode={toggleLocalMode}
        onPushAll={pushAll}
        onFontSize={setFontSize}
        sidebarOpen={sidebarOpen}
      />

      {/* Local mode banner */}
      {localMode && (
        <div className="local-mode-banner">
          <span className="local-mode-banner-icon">⬡</span>
          <span>
            <strong>Local mode</strong> — your edits stay on this device only.
            {dirtyFiles.size > 0 && ` ${dirtyFiles.size} file${dirtyFiles.size !== 1 ? 's' : ''} with unpushed changes.`}
          </span>
          <div className="local-mode-banner-actions">
            {dirtyFiles.size > 0 && (
              <button className="banner-push-btn" onClick={pushAll}>
                ↑ Push all ({dirtyFiles.size})
              </button>
            )}
            <button className="banner-go-live-btn" onClick={toggleLocalMode}>
              Go Live →
            </button>
          </div>
        </div>
      )}

      <div className="workspace">
        {sidebarOpen && (
          <div className="sidebar">
            <div className="sidebar-tabs">
              <button className={`sidebar-tab ${sidebarTab === 'files'   ? 'sidebar-tab--active' : ''}`} onClick={() => setSidebarTab('files')}>Files</button>
              <button className={`sidebar-tab ${sidebarTab === 'outline' ? 'sidebar-tab--active' : ''}`} onClick={() => setSidebarTab('outline')}>Outline</button>
              <button className={`sidebar-tab ${sidebarTab === 'assets'  ? 'sidebar-tab--active' : ''}`} onClick={() => setSidebarTab('assets')}>Assets</button>
            </div>
            {sidebarTab === 'files' && (
              <FileTree roomId={roomId} files={files} activeFileId={activeFileId} onSelect={switchFile} />
            )}
            {sidebarTab === 'outline' && (
              <OutlinePanel files={files} onJumpToLine={handleOutlineJump} />
            )}
            {sidebarTab === 'assets' && (
              <AssetsPanel roomId={roomId} onInsert={handleInsertAsset} />
            )}
          </div>
        )}

        <div className="main-area">
          <SplitPane
            left={
              <div className="editor-panel">
                <div className="panel-header">
                  <div className="breadcrumb">
                    {activeFile?.folder && (
                      <span className="breadcrumb-folder">{activeFile.folder} /</span>
                    )}
                    <span className="breadcrumb-file">
                      {activeFile?.name ?? 'main.tex'}
                    </span>
                    {dirtyFiles.has(activeFileId) && (
                      <span className="dirty-dot" title="Unpushed local changes" />
                    )}
                  </div>
                  <div className="panel-header-right">
                    {localMode && dirtyFiles.has(activeFileId) && (
                      <button
                        className="push-file-btn"
                        title={`Push ${activeFile?.name ?? 'this file'} to Firestore (Ctrl+S)`}
                        onClick={() => pushFile(activeFileId)}
                      >
                        ↑ Push file
                      </button>
                    )}
                    <UserList users={users} currentUserId={currentUser.id} />
                  </div>
                </div>
                <div className="editor-body" style={{ position: 'relative' }}>
                  <LatexEditor
                    content={content}
                    users={users}
                    currentUser={currentUser}
                    onChange={handleContentChange}
                    onCursorChange={handleCursorChange}
                    onInsertRef={insertTextRef}
                    onJumpRef={jumpToLineRef}
                    fontSize={fontSize}
                  />
                </div>
                <StatusBar
                  currentUser={currentUser}
                  userCount={users.length}
                  contentLength={content.length}
                  localMode={localMode}
                  activeFileId={activeFileId}
                  dirtyFiles={dirtyFiles}
                />
              </div>
            }
            right={
              <div className="preview-panel">
                <div className="panel-header">
                  <span>PDF Preview</span>
                  {pdfUrl && <span className="preview-badge">✓ compiled</span>}
                </div>
                <div className="preview-body">
                  <PdfPreview
                    pdfUrl={pdfUrl}
                    compileError={compileError}
                    compiling={compiling}
                    elapsed={elapsed}
                    statusMsg={statusMsg}
                    onJumpToLine={handleJumpToLine}
                  />
                </div>
              </div>
            }
            defaultSplit={50}
          />
        </div>
      </div>
    </div>
  )
}
