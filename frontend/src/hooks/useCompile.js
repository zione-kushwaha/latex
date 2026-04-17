import { useState, useCallback, useRef, useEffect } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const PROGRESS_MESSAGES = [
  [0,   'Starting compiler…'],
  [3,   'Downloading TeX packages (first run only)…'],
  [10,  'Compiling LaTeX…'],
  [20,  'Rendering diagrams…'],
  [40,  'Almost done…'],
  [70,  'Still working — complex document…'],
  [100, 'Nearly there…'],
]

export function useCompile() {
  const [pdfUrl, setPdfUrl]             = useState(null)
  const [compileError, setCompileError] = useState(null)
  const [compiling, setCompiling]       = useState(false)
  const [elapsed, setElapsed]           = useState(0)
  const [statusMsg, setStatusMsg]       = useState('')

  const pdfUrlRef = useRef(null)
  const timerRef  = useRef(null)
  const startRef  = useRef(null)

  useEffect(() => {
    if (!compiling) {
      clearInterval(timerRef.current)
      setElapsed(0)
      return
    }
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      setElapsed(secs)
      const msg = PROGRESS_MESSAGES.filter(([t]) => secs >= t).pop()
      setStatusMsg(msg ? msg[1] : '')
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [compiling])

  // assets = [{ name, base64, mimeType }] — optional
  const compile = useCallback(async (latex, assets = []) => {
    setCompiling(true)
    setCompileError(null)
    setStatusMsg(PROGRESS_MESSAGES[0][1])

    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = null
    }

    try {
      const res = await fetch(`${BACKEND_URL}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latex,
          // Send only name + base64 — mimeType not needed by backend
          assets: assets.map((a) => ({ name: a.name, base64: a.base64 })),
        }),
      })

      const data = await res.json()

      if (data.error) {
        setCompileError(data.error)
        setPdfUrl(null)
      } else {
        const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0))
        const blob  = new Blob([bytes], { type: 'application/pdf' })
        const url   = URL.createObjectURL(blob)
        pdfUrlRef.current = url
        setPdfUrl(url)
      }
    } catch (err) {
      setCompileError(
        err.message.includes('fetch')
          ? 'Cannot reach backend. Is the Rust server running on port 3001?'
          : `Network error: ${err.message}`
      )
    } finally {
      setCompiling(false)
    }
  }, [])

  return { pdfUrl, compileError, compiling, elapsed, statusMsg, compile }
}
