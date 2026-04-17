import { useRef, useState, useCallback, useEffect } from 'react'

export default function SplitPane({ left, right, defaultSplit = 50, minPct = 20, maxPct = 80 }) {
  const [split, setSplit] = useState(defaultSplit)
  const dragging = useRef(false)
  const containerRef = useRef(null)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct  = ((e.clientX - rect.left) / rect.width) * 100
      setSplit(Math.min(maxPct, Math.max(minPct, pct)))
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [minPct, maxPct])

  return (
    <div ref={containerRef} className="split-pane">
      <div className="split-left" style={{ width: `${split}%` }}>
        {left}
      </div>
      <div className="split-divider" onMouseDown={onMouseDown}>
        <div className="split-divider-handle" />
      </div>
      <div className="split-right" style={{ width: `${100 - split}%` }}>
        {right}
      </div>
    </div>
  )
}
