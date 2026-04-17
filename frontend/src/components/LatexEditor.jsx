import { useEffect, useRef, useState, useCallback } from 'react'
import { EditorView, keymap, Decoration, ViewPlugin } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { latex } from 'codemirror-lang-latex'
import { EditorState, RangeSetBuilder } from '@codemirror/state'
import SnippetPalette from './SnippetPalette'

// ── Snippet helpers ────────────────────────────────────────────────────────

function wrapSelection(view, prefix, suffix) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const insert = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: selected ? from + insert.length : from + prefix.length },
  })
  view.focus()
  return true
}

function insertSnippet(view, snippet, cursorOffset) {
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, to: from, insert: snippet },
    selection: { anchor: from + cursorOffset },
  })
  view.focus()
  return true
}

const latexKeymap = [
  { key: 'Ctrl-b', run: (v) => wrapSelection(v, '\\textbf{', '}') },
  { key: 'Ctrl-i', run: (v) => wrapSelection(v, '\\textit{', '}') },
  { key: 'Ctrl-u', run: (v) => wrapSelection(v, '\\underline{', '}') },
  { key: 'Ctrl-k', run: (v) => wrapSelection(v, '\\href{}{', '}') },
  { key: 'Ctrl-e', run: (v) => insertSnippet(v, '\n\\begin{equation}\n  \n\\end{equation}\n', 20) },
  { key: 'Ctrl-Shift-e', run: (v) => insertSnippet(v, '\n\\begin{align}\n  \n\\end{align}\n', 17) },
  {
    key: 'Ctrl-Shift-f',
    run: (v) => insertSnippet(
      v,
      '\n\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}\n',
      67,
    ),
  },
  {
    key: 'Ctrl-Shift-t',
    run: (v) => insertSnippet(
      v,
      '\n\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{cc}\n    \\toprule\n    A & B \\\\\n    \\midrule\n    1 & 2 \\\\\n    \\bottomrule\n  \\end{tabular}\n  \\caption{}\n\\end{table}\n',
      18,
    ),
  },
]

// ── \begin{} auto-close ────────────────────────────────────────────────────

const autoCloseBegin = EditorView.inputHandler.of((view, _from, _to, text) => {
  if (text !== '\n') return false
  const pos  = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const m    = line.text.match(/\\begin\{([^}]+)\}/)
  if (!m) return false
  const envName = m[1]
  const indent  = line.text.match(/^(\s*)/)[1]
  const insert  = `\n${indent}  \n${indent}\\end{${envName}}`
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: { anchor: pos + indent.length + 3 },
  })
  return true
})

// ── Cursor decorations ─────────────────────────────────────────────────────

function buildCursorDecorations(users, currentUserId, docLength) {
  const builder = new RangeSetBuilder()
  const sorted = [...users]
    .filter((u) => u.id !== currentUserId && typeof u.cursor === 'number')
    .sort((a, b) => a.cursor - b.cursor)

  for (const u of sorted) {
    const pos = Math.min(u.cursor, docLength)
    builder.add(pos, pos, Decoration.widget({
      widget: new CursorWidget(u.name, u.color),
      side: 1,
    }))
  }
  return builder.finish()
}

class CursorWidget {
  constructor(name, color) { this.name = name; this.color = color }
  toDOM() {
    const el = document.createElement('span')
    el.style.cssText = `border-left:2px solid ${this.color};margin-left:-1px;position:relative;display:inline-block;height:1.2em;vertical-align:text-bottom;`
    const label = document.createElement('span')
    label.textContent = this.name
    label.style.cssText = `position:absolute;top:-1.4em;left:0;background:${this.color};color:#fff;font-size:10px;padding:1px 4px;border-radius:3px;white-space:nowrap;pointer-events:none;z-index:10;`
    el.appendChild(label)
    return el
  }
  eq(other) { return other.name === this.name && other.color === this.color }
  ignoreEvent() { return true }
}

// ── Find & Replace bar ─────────────────────────────────────────────────────

function FindReplaceBar({ viewRef, onClose }) {
  const [find, setFind]             = useState('')
  const [replace, setReplace]       = useState('')
  const [matchCase, setMatchCase]   = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const findRef = useRef(null)

  useEffect(() => { findRef.current?.focus() }, [])

  const getMatches = useCallback((searchStr) => {
    const view = viewRef.current
    if (!view || !searchStr) return []
    const text  = view.state.doc.toString()
    const flags = matchCase ? 'g' : 'gi'
    const re    = new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    const matches = []
    let m
    while ((m = re.exec(text)) !== null) matches.push({ from: m.index, to: m.index + m[0].length })
    return matches
  }, [viewRef, matchCase])

  useEffect(() => { setMatchCount(getMatches(find).length) }, [find, matchCase, getMatches])

  const handleFindNext = () => {
    const view = viewRef.current
    if (!view || !find) return
    const matches = getMatches(find)
    if (!matches.length) return
    const head = view.state.selection.main.head
    const next = matches.find((m) => m.from > head) || matches[0]
    view.dispatch({ selection: { anchor: next.from, head: next.to }, scrollIntoView: true })
    view.focus()
  }

  const handleReplaceOne = () => {
    const view = viewRef.current
    if (!view || !find) return
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const flags = matchCase ? '' : 'i'
    if (new RegExp(`^${find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, flags).test(selected)) {
      view.dispatch({ changes: { from, to, insert: replace }, selection: { anchor: from + replace.length } })
    }
    handleFindNext()
  }

  const handleReplaceAll = () => {
    const view = viewRef.current
    if (!view || !find) return
    const matches = getMatches(find)
    if (!matches.length) return
    view.dispatch({ changes: matches.map((m) => ({ from: m.from, to: m.to, insert: replace })) })
    view.focus()
  }

  return (
    <div className="find-replace-bar" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') { e.preventDefault(); handleFindNext() } }}>
      <div className="find-replace-row">
        <input ref={findRef} className="find-input" placeholder="Find…" value={find} onChange={(e) => setFind(e.target.value)} />
        <label className="find-case-toggle" title="Match case">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />Aa
        </label>
        <span className="find-count">{find ? `${matchCount} match${matchCount !== 1 ? 'es' : ''}` : ''}</span>
        <button className="find-btn" onClick={handleFindNext} disabled={!find}>Next</button>
      </div>
      <div className="find-replace-row">
        <input className="find-input" placeholder="Replace…" value={replace} onChange={(e) => setReplace(e.target.value)} />
        <button className="find-btn" onClick={handleReplaceOne} disabled={!find}>Replace</button>
        <button className="find-btn" onClick={handleReplaceAll} disabled={!find}>All</button>
        <button className="find-close-btn" onClick={onClose} title="Close (Esc)">✕</button>
      </div>
    </div>
  )
}

// ── Format toolbar strip ───────────────────────────────────────────────────

const FORMAT_BTNS = [
  { label: 'B',      title: 'Bold (Ctrl+B)',          style: { fontWeight: 700 },                    action: (v) => wrapSelection(v, '\\textbf{', '}') },
  { label: 'I',      title: 'Italic (Ctrl+I)',         style: { fontStyle: 'italic' },                action: (v) => wrapSelection(v, '\\textit{', '}') },
  { label: 'U',      title: 'Underline (Ctrl+U)',      style: { textDecoration: 'underline' },        action: (v) => wrapSelection(v, '\\underline{', '}') },
  { label: 'TT',     title: 'Monospace',               style: { fontFamily: 'monospace' },            action: (v) => wrapSelection(v, '\\texttt{', '}') },
  { label: '|', sep: true },
  { label: '§',      title: 'Section',                 style: {},                                     action: (v) => insertSnippet(v, '\\section{', 9) },
  { label: '§§',     title: 'Subsection',              style: { fontSize: 11 },                       action: (v) => insertSnippet(v, '\\subsection{', 12) },
  { label: '|', sep: true },
  { label: '$',      title: 'Inline math',             style: { fontFamily: 'monospace' },            action: (v) => insertSnippet(v, '$  $', 2) },
  { label: '∑',      title: 'Equation block (Ctrl+E)', style: {},                                     action: (v) => insertSnippet(v, '\n\\begin{equation}\n  \n\\end{equation}\n', 20) },
  { label: '≡',      title: 'Align block',             style: {},                                     action: (v) => insertSnippet(v, '\n\\begin{align}\n  \n\\end{align}\n', 17) },
  { label: '|', sep: true },
  { label: '•',      title: 'Itemize list',            style: {},                                     action: (v) => insertSnippet(v, '\\begin{itemize}\n  \\item \n\\end{itemize}\n', 23) },
  { label: '1.',     title: 'Enumerate list',          style: { fontSize: 11 },                       action: (v) => insertSnippet(v, '\\begin{enumerate}\n  \\item \n\\end{enumerate}\n', 25) },
  { label: '🖼',     title: 'Figure (Ctrl+⇧F)',        style: {},                                     action: (v) => insertSnippet(v, '\n\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}\n', 67) },
  { label: '⊞',      title: 'Table (Ctrl+⇧T)',         style: {},                                     action: (v) => insertSnippet(v, '\n\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{cc}\n    \\toprule\n    A & B \\\\\n    \\midrule\n    1 & 2 \\\\\n    \\bottomrule\n  \\end{tabular}\n  \\caption{}\n\\end{table}\n', 18) },
  { label: '|', sep: true },
  { label: '⚡',     title: 'Snippet palette (Ctrl+Space)', style: {}, snippetTrigger: true },
]

function FormatBar({ viewRef, onOpenSnippets }) {
  return (
    <div className="format-bar">
      {FORMAT_BTNS.map((btn, i) => {
        if (btn.sep) return <div key={i} className="format-bar-sep" />
        if (btn.snippetTrigger) {
          return (
            <button key={i} className="format-btn" title={btn.title} onClick={onOpenSnippets}>
              {btn.label}
            </button>
          )
        }
        return (
          <button
            key={i}
            className="format-btn"
            title={btn.title}
            style={btn.style}
            onMouseDown={(e) => {
              e.preventDefault() // don't steal focus from editor
              const view = viewRef.current
              if (view) btn.action(view)
            }}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function LatexEditor({ content, users, currentUser, onChange, onCursorChange, onInsertRef, onJumpRef, fontSize = 14 }) {
  const containerRef   = useRef(null)
  const viewRef        = useRef(null)
  const onChangeRef    = useRef(onChange)
  const onCursorRef    = useRef(onCursorChange)
  const usersRef       = useRef(users)
  const currentUserRef = useRef(currentUser)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showSnippets, setShowSnippets]       = useState(false)

  useEffect(() => { onChangeRef.current = onChange },       [onChange])
  useEffect(() => { onCursorRef.current = onCursorChange }, [onCursorChange])
  useEffect(() => { usersRef.current    = users },          [users])

  useEffect(() => {
    if (!onInsertRef) return
    onInsertRef.current = (text) => {
      const view = viewRef.current
      if (!view) return
      const pos = view.state.selection.main.head
      view.dispatch({ changes: { from: pos, to: pos, insert: text }, selection: { anchor: pos + text.length } })
      view.focus()
    }
  }, [onInsertRef])

  useEffect(() => {
    if (!onJumpRef) return
    onJumpRef.current = (lineNo) => {
      const view = viewRef.current
      if (!view) return
      const clamped = Math.max(1, Math.min(lineNo, view.state.doc.lines))
      const line = view.state.doc.line(clamped)
      view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
      view.focus()
    }
  }, [onJumpRef])

  // Ctrl+H → find/replace, Ctrl+Space → snippets
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); setShowFindReplace((v) => !v) }
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') { e.preventDefault(); setShowSnippets((v) => !v) }
      if (e.key === 'Escape') { setShowFindReplace(false); setShowSnippets(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Mount editor ONCE
  useEffect(() => {
    if (!containerRef.current) return

    const remoteCursors = ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.decorations = buildCursorDecorations(usersRef.current, currentUserRef.current.id, view.state.doc.length)
        }
        update(update) {
          this.decorations = buildCursorDecorations(usersRef.current, currentUserRef.current.id, update.state.doc.length)
        }
      },
      { decorations: (v) => v.decorations }
    )

    const view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          history(),
          keymap.of([...latexKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
          latex(),
          oneDark,
          EditorView.lineWrapping,
          autoCloseBegin,
          remoteCursors,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head
              onCursorRef.current(head)
              const line = update.state.doc.lineAt(head)
              window.dispatchEvent(new CustomEvent('tlc:cursor', { detail: { line: line.number, col: head - line.from + 1 } }))
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: `${fontSize}px` },
            '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    return () => view.destroy()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === content) return
    const anchor = Math.min(view.state.selection.main.anchor, content.length)
    const head   = Math.min(view.state.selection.main.head,   content.length)
    view.dispatch({ changes: { from: 0, to: current.length, insert: content }, selection: { anchor, head } })
  }, [content])

  useEffect(() => { viewRef.current?.dispatch({}) }, [users])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const scroller = view.dom.querySelector('.cm-scroller')
    if (scroller) scroller.style.fontSize = `${fontSize}px`
  }, [fontSize])

  const handleSnippetInsert = useCallback((text, cursorOffset) => {
    const view = viewRef.current
    if (!view) return
    const pos = view.state.selection.main.head
    view.dispatch({ changes: { from: pos, to: pos, insert: text }, selection: { anchor: pos + cursorOffset } })
    view.focus()
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FormatBar viewRef={viewRef} onOpenSnippets={() => setShowSnippets(true)} />
      {showFindReplace && <FindReplaceBar viewRef={viewRef} onClose={() => setShowFindReplace(false)} />}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
      {showSnippets && (
        <SnippetPalette
          onInsert={handleSnippetInsert}
          onClose={() => setShowSnippets(false)}
        />
      )}
    </div>
  )
}
