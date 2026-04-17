import { useState, useEffect, useRef } from 'react'

const SNIPPETS = [
  {
    category: 'Text',
    items: [
      { label: 'Bold',        key: 'Ctrl+B', snippet: '\\textbf{|}',           cursor: 8 },
      { label: 'Italic',      key: 'Ctrl+I', snippet: '\\textit{|}',           cursor: 8 },
      { label: 'Underline',   key: 'Ctrl+U', snippet: '\\underline{|}',        cursor: 11 },
      { label: 'Small caps',  key: '',       snippet: '\\textsc{|}',            cursor: 8 },
      { label: 'Monospace',   key: '',       snippet: '\\texttt{|}',            cursor: 8 },
      { label: 'Colored text',key: '',       snippet: '\\textcolor{red}{|}',    cursor: 17 },
      { label: 'Hyperlink',   key: 'Ctrl+K', snippet: '\\href{url}{|}',         cursor: 12 },
      { label: 'Footnote',    key: '',       snippet: '\\footnote{|}',          cursor: 10 },
    ],
  },
  {
    category: 'Structure',
    items: [
      { label: 'Section',       key: '', snippet: '\\section{|}',              cursor: 9 },
      { label: 'Subsection',    key: '', snippet: '\\subsection{|}',           cursor: 12 },
      { label: 'Subsubsection', key: '', snippet: '\\subsubsection{|}',        cursor: 15 },
      { label: 'Paragraph',     key: '', snippet: '\\paragraph{|}',            cursor: 11 },
      { label: 'Label',         key: '', snippet: '\\label{|}',                cursor: 7 },
      { label: 'Ref',           key: '', snippet: '\\ref{|}',                  cursor: 5 },
      { label: 'Cite',          key: '', snippet: '\\cite{|}',                 cursor: 6 },
      { label: 'New page',      key: '', snippet: '\\newpage',                 cursor: 8 },
    ],
  },
  {
    category: 'Math',
    items: [
      { label: 'Inline math',   key: '',       snippet: '$|$',                                cursor: 1 },
      { label: 'Display math',  key: '',       snippet: '\\[\n  |\n\\]',                       cursor: 4 },
      { label: 'Equation',      key: 'Ctrl+E', snippet: '\n\\begin{equation}\n  |\n\\end{equation}\n', cursor: 20 },
      { label: 'Align',         key: 'Ctrl+⇧E',snippet: '\n\\begin{align}\n  |\n\\end{align}\n',    cursor: 17 },
      { label: 'Fraction',      key: '',       snippet: '\\frac{|}{} ',                       cursor: 7 },
      { label: 'Sum',           key: '',       snippet: '\\sum_{i=1}^{n} |',                  cursor: 15 },
      { label: 'Integral',      key: '',       snippet: '\\int_{|}^{} ',                      cursor: 6 },
      { label: 'Matrix',        key: '',       snippet: '\\begin{pmatrix}\n  | & \\\\\n  & \n\\end{pmatrix}', cursor: 18 },
    ],
  },
  {
    category: 'Environments',
    items: [
      { label: 'Figure',      key: 'Ctrl+⇧F', snippet: '\n\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{|}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}\n', cursor: 67 },
      { label: 'Table',       key: 'Ctrl+⇧T', snippet: '\n\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{cc}\n    \\toprule\n    A & B \\\\\n    \\midrule\n    | & \\\\\n    \\bottomrule\n  \\end{tabular}\n  \\caption{}\n\\end{table}\n', cursor: 75 },
      { label: 'Itemize',     key: '', snippet: '\\begin{itemize}\n  \\item |\n\\end{itemize}\n',  cursor: 23 },
      { label: 'Enumerate',   key: '', snippet: '\\begin{enumerate}\n  \\item |\n\\end{enumerate}\n', cursor: 25 },
      { label: 'Description', key: '', snippet: '\\begin{description}\n  \\item[|] \n\\end{description}\n', cursor: 27 },
      { label: 'Verbatim',    key: '', snippet: '\\begin{verbatim}\n|\n\\end{verbatim}\n',       cursor: 17 },
      { label: 'Abstract',    key: '', snippet: '\\begin{abstract}\n|\n\\end{abstract}\n',       cursor: 17 },
      { label: 'Minipage',    key: '', snippet: '\\begin{minipage}{0.5\\textwidth}\n  |\n\\end{minipage}', cursor: 33 },
    ],
  },
  {
    category: 'Symbols',
    items: [
      { label: 'Alpha α',    key: '', snippet: '\\alpha',    cursor: 6 },
      { label: 'Beta β',     key: '', snippet: '\\beta',     cursor: 5 },
      { label: 'Gamma γ',    key: '', snippet: '\\gamma',    cursor: 6 },
      { label: 'Delta δ',    key: '', snippet: '\\delta',    cursor: 6 },
      { label: 'Sigma Σ',    key: '', snippet: '\\Sigma',    cursor: 6 },
      { label: 'Pi π',       key: '', snippet: '\\pi',       cursor: 3 },
      { label: 'Infinity ∞', key: '', snippet: '\\infty',    cursor: 6 },
      { label: 'Arrow →',    key: '', snippet: '\\rightarrow', cursor: 11 },
    ],
  },
]

export default function SnippetPalette({ onInsert, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [search, setSearch]                 = useState('')
  const searchRef = useRef(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = search.trim()
    ? SNIPPETS.flatMap((c) => c.items).filter((i) =>
        i.label.toLowerCase().includes(search.toLowerCase())
      )
    : SNIPPETS[activeCategory].items

  const handleInsert = (item) => {
    // Replace | with cursor position marker — we pass raw snippet + cursorOffset
    const text = item.snippet.replace('|', '')
    onInsert(text, item.cursor)
    onClose()
  }

  return (
    <div className="snippet-overlay" onClick={onClose}>
      <div className="snippet-palette" onClick={(e) => e.stopPropagation()}>
        <div className="snippet-header">
          <span className="snippet-title">⚡ Snippet Palette</span>
          <button className="find-close-btn" onClick={onClose}>✕</button>
        </div>

        <input
          ref={searchRef}
          className="snippet-search"
          placeholder="Search snippets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {!search.trim() && (
          <div className="snippet-cats">
            {SNIPPETS.map((c, i) => (
              <button
                key={c.category}
                className={`snippet-cat-btn ${activeCategory === i ? 'snippet-cat-btn--active' : ''}`}
                onClick={() => setActiveCategory(i)}
              >
                {c.category}
              </button>
            ))}
          </div>
        )}

        <div className="snippet-list">
          {filtered.map((item) => (
            <button
              key={item.label}
              className="snippet-item"
              onClick={() => handleInsert(item)}
            >
              <span className="snippet-item-label">{item.label}</span>
              {item.key && <kbd className="snippet-item-key">{item.key}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
