import { useState, useRef } from 'react'

const NOISE_PATTERNS = [
  'fontconfig error',
  'cannot load default config',
  'no such file: (null)',
  'halted on potentially-recoverable error',
]

function isNoise(line) {
  const l = line.toLowerCase()
  return NOISE_PATTERNS.some((n) => l.includes(n))
}

function parseErrors(raw) {
  if (!raw) return []
  const errors = []

  // Tectonic / pdflatex formats:
  // "! LaTeX Error: ..."          — fatal error line
  // "./input.tex:42: ..."         — file:line: error
  // "input.tex:42: ..."
  // "error: input.tex:42: ..."
  // "warning: ..."
  const fileLineRe = /(?:\.\/)?(?:input\.tex|[^:\s]+\.tex):(\d+):\s*(.+)/i
  const bangRe     = /^!\s*(.+)/
  const errorRe    = /^error:\s*(?:(?:\.\/)?[^:\s]*\.tex:(\d+):\s*)?(.+)/i
  const warnRe     = /^warning:\s*(.+)/i

  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || isNoise(t)) continue

    const fl = t.match(fileLineRe)
    if (fl) { errors.push({ type: 'error', lineNo: fl[1], msg: fl[2].trim() }); continue }

    const bang = t.match(bangRe)
    if (bang) { errors.push({ type: 'error', lineNo: null, msg: bang[1].trim() }); continue }

    const e = t.match(errorRe)
    if (e) { errors.push({ type: 'error', lineNo: e[1] || null, msg: e[2].trim() }); continue }

    const w = t.match(warnRe)
    if (w) errors.push({ type: 'warn', lineNo: null, msg: w[1].trim() })
  }

  return errors.length ? errors : [{ type: 'error', lineNo: null, msg: raw.trim() }]
}

function getSuggestion(msg) {
  const m = msg.toLowerCase()
  if (m.includes('multirow'))                          return '\\usepackage{multirow}'
  if (m.includes('cellcolor') || m.includes('rowcolor')) return '\\usepackage{colortbl}'
  if (m.includes('blindtext'))                         return '\\usepackage{blindtext}'
  if (m.includes('tcolorbox'))                         return '\\usepackage{tcolorbox}'
  if (m.includes('listings') || m.includes('lstset')) return '\\usepackage{listings}'
  if (m.includes('tikz'))                              return '\\usepackage{tikz}'
  if (m.includes('pgfplots'))                          return '\\usepackage{pgfplots}'
  if (m.includes('hyperref'))                          return '\\usepackage{hyperref}'
  if (m.includes('geometry'))                          return '\\usepackage{geometry}'
  if (m.includes('fancyhdr'))                          return '\\usepackage{fancyhdr}'
  if (m.includes('multicol'))                          return '\\usepackage{multicol}'
  if (m.includes('undefined control sequence'))        return 'Check for typos in command names'
  if (m.includes('missing $ inserted'))                return 'Wrap math in $ ... $ or \\[ ... \\]'
  if (m.includes('file not found') || m.includes('cannot find')) return 'Check \\input{} paths and asset names'
  return null
}

export default function PdfPreview({ pdfUrl, compileError, compiling, elapsed, statusMsg, onJumpToLine }) {
  const [zoom, setZoom] = useState(100)
  const iframeRef = useRef(null)

  if (compiling) {
    const pct = Math.min(95, (elapsed / 120) * 100)
    return (
      <div className="preview-placeholder">
        <div className="compile-spinner-wrap">
          <div className="compile-spinner" />
          <span className="compile-spinner-icon">∂</span>
        </div>
        <p className="compile-status">{statusMsg}</p>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="compile-elapsed">{elapsed}s elapsed</p>
        {elapsed >= 5 && (
          <p className="compile-hint">
            💡 First compile downloads TeX packages (~200 MB). Later compiles are much faster.
          </p>
        )}
      </div>
    )
  }

  if (compileError) {
    const errors = parseErrors(compileError)
    const realErrors = errors.filter((e) => e.type === 'error')
    return (
      <div className="preview-error">
        <div className="error-header">
          <div className="error-header-left">
            <span className="error-header-icon">✕</span>
            <span>Compilation Failed</span>
          </div>
          <span className="error-count">{realErrors.length} error{realErrors.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="error-list">
          {errors.map((e, i) => {
            const suggestion = e.type === 'error' ? getSuggestion(e.msg) : null
            return (
              <div key={i} className={`error-item error-item--${e.type}`}>
                <div className="error-item-top">
                  <span className={`error-badge ${e.type === 'error' ? 'badge-error' : 'badge-warn'}`}>
                    {e.type === 'error' ? 'ERROR' : 'WARN'}
                  </span>
                  {e.lineNo && (
                    <button
                      className="error-line-btn"
                      title="Click to jump to this line in the editor"
                      onClick={() => onJumpToLine?.(Number(e.lineNo))}
                    >
                      <span className="error-line-icon">↗</span>
                      Line {e.lineNo}
                    </button>
                  )}
                </div>
                <p className="error-msg">{e.msg}</p>
                {suggestion && (
                  <p className="error-suggestion">
                    <span className="error-suggestion-arrow">→</span>
                    <code>{suggestion}</code>
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <details className="error-raw">
          <summary>Show raw compiler output</summary>
          <pre>{compileError}</pre>
        </details>
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="preview-placeholder">
        <div className="preview-empty-icon">∂</div>
        <p className="preview-empty-title">No PDF yet</p>
        <p className="preview-empty-sub">
          Press <kbd className="inline-kbd">Ctrl+Enter</kbd> or click <strong>▶ Compile</strong>
        </p>
        <p className="compile-hint">
          First compile may take 1–3 min while Tectonic downloads TeX packages.
        </p>
        <div className="shortcut-hints">
          <p className="shortcut-hints-title">Editor shortcuts</p>
          <div className="shortcut-grid">
            <kbd>Ctrl+Enter</kbd><span>Compile</span>
            <kbd>Ctrl+B</kbd><span>\textbf{'{}'}</span>
            <kbd>Ctrl+I</kbd><span>\textit{'{}'}</span>
            <kbd>Ctrl+U</kbd><span>\underline{'{}'}</span>
            <kbd>Ctrl+E</kbd><span>equation block</span>
            <kbd>Ctrl+⇧+E</kbd><span>align block</span>
            <kbd>Ctrl+⇧+F</kbd><span>figure block</span>
            <kbd>Ctrl+⇧+T</kbd><span>table block</span>
            <kbd>Tab</kbd><span>indent</span>
            <kbd>Ctrl+H</kbd><span>find &amp; replace</span>
            <kbd>Ctrl+Space</kbd><span>snippet palette</span>
            <kbd>Ctrl+S</kbd><span>push file (local mode)</span>
          </div>
        </div>
      </div>
    )
  }

  const iframeSrc = `${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=${zoom}`

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-left">
          <span className="pdf-toolbar-hint">💡 Click links in PDF to navigate</span>
        </div>
        <div className="pdf-toolbar-right">
          <button className="pdf-tool-btn" onClick={() => setZoom((z) => Math.max(50, z - 25))} title="Zoom out">−</button>
          <span className="pdf-zoom-label">{zoom}%</span>
          <button className="pdf-tool-btn" onClick={() => setZoom((z) => Math.min(200, z + 25))} title="Zoom in">+</button>
          <button className="pdf-tool-btn" onClick={() => setZoom(100)} title="Reset zoom">⊡</button>
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="pdf-tool-btn" title="Open in new tab">⤢</a>
        </div>
      </div>
      <iframe ref={iframeRef} src={iframeSrc} title="PDF Preview" className="pdf-iframe" />
    </div>
  )
}
