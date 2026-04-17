export default function Toolbar({
  roomId, compiling, autoCompile, pdfUrl,
  content, activeFileName, sidebarOpen,
  localMode, dirtyCount,
  fontSize, onFontSize,
  onCompile, onToggleAutoCompile, onToggleSidebar,
  onToggleLocalMode, onPushAll,
}) {
  const copyLink = () => navigator.clipboard.writeText(window.location.href)

  const downloadTex = () => {
    const blob = new Blob([content], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = activeFileName || `${roomId}.tex`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadPdf = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `${roomId}.pdf`
    a.click()
  }

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <button
          className={`btn btn-ghost sidebar-toggle ${sidebarOpen ? 'sidebar-toggle--open' : ''}`}
          onClick={onToggleSidebar}
          title="Toggle sidebar"
        >☰</button>
        <span className="logo">📄 TexLiteCollab</span>
        <button className="btn btn-ghost" onClick={copyLink} title="Copy room link">
          🔗 {roomId}
        </button>
      </div>

      <div className="toolbar-right">
        {/* Local / Live mode toggle */}
        <button
          className={`mode-toggle-btn ${localMode ? 'mode-toggle-btn--local' : 'mode-toggle-btn--live'}`}
          onClick={onToggleLocalMode}
          title={localMode
            ? 'Local mode ON — edits stay local. Click to go live.'
            : 'Live mode — edits sync in real time. Click to go local.'}
        >
          <span className={`mode-dot ${localMode ? 'mode-dot--local' : 'mode-dot--live'}`} />
          {localMode ? '⬡ Local' : '● Live'}
        </button>

        {/* Push all — only when dirty files exist in local mode */}
        {localMode && dirtyCount > 0 && (
          <button
            className="push-all-btn"
            onClick={onPushAll}
            title={`Push all ${dirtyCount} modified file${dirtyCount !== 1 ? 's' : ''} to Firestore`}
          >
            ↑ Push all
            <span className="push-all-badge">{dirtyCount}</span>
          </button>
        )}

        <div className="toolbar-sep" />

        {/* Font size */}
        <div className="font-size-ctrl" title="Editor font size">
          <button
            className="font-size-btn"
            onClick={() => onFontSize((s) => Math.max(10, s - 1))}
            disabled={fontSize <= 10}
          >A−</button>
          <span className="font-size-label">{fontSize}</span>
          <button
            className="font-size-btn"
            onClick={() => onFontSize((s) => Math.min(24, s + 1))}
            disabled={fontSize >= 24}
          >A+</button>
        </div>

        <div className="toolbar-sep" />

        <label className="toggle-label">
          <input type="checkbox" checked={autoCompile} onChange={onToggleAutoCompile} />
          Auto-compile
        </label>
        <button className="btn btn-primary" onClick={onCompile} disabled={compiling} title="Compile (Ctrl+Enter)">
          {compiling ? '⏳ Compiling…' : '▶ Compile'}
        </button>
        <button className="btn btn-ghost" onClick={downloadTex} title="Download .tex">⬇ .tex</button>
        <button className="btn btn-ghost" onClick={downloadPdf} disabled={!pdfUrl} title="Download PDF">⬇ PDF</button>
      </div>
    </header>
  )
}
