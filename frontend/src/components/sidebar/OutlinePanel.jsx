const HEADING_RE = /^\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\{([^}]+)\}/

const INDENT = { part: 0, chapter: 0, section: 0, subsection: 1, subsubsection: 2, paragraph: 3 }

const ICONS = { part: '\u25c8', chapter: '\u25c9', section: '\u00a7', subsection: '\u203a', subsubsection: '\u00b7', paragraph: '\u2013' }

export default function OutlinePanel({ files, onJumpToLine }) {
  const entries = []
  const main = files['main']
  if (!main?.content) return <div className="outline-empty">No content yet.</div>

  const processContent = (content, fileId) => {
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const inputMatch = lines[i].match(/^\\input\{([^}]+)\}/)
      if (inputMatch) {
        const fid = inputMatch[1].replace(/\.tex$/, '').replace(/\//g, '__')
        if (files[fid]?.content) { processContent(files[fid].content, fid); continue }
      }
      const m = lines[i].match(HEADING_RE)
      if (m) entries.push({ type: m[1], title: m[2], fileId, line: i + 1 })
    }
  }
  processContent(main.content, 'main')

  if (!entries.length) {
    return (
      <div className="outline-empty">
        No sections found.<br />
        <span style={{ fontSize: 10 }}>Add \section{'{...}'} to build an outline.</span>
      </div>
    )
  }

  return (
    <div className="outline-panel">
      {entries.map((e, i) => (
        <button
          key={i}
          className="outline-item"
          style={{ paddingLeft: 12 + INDENT[e.type] * 14 }}
          onClick={() => onJumpToLine(e.line, e.fileId)}
          title={`${e.type}: ${e.title}`}
        >
          <span className="outline-icon">{ICONS[e.type]}</span>
          <span className="outline-title">{e.title}</span>
        </button>
      ))}
    </div>
  )
}
