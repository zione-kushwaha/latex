import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'

const RECENT_KEY = 'tlc:recent_rooms'
const MAX_RECENT = 5

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#f59e0b',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316',
  '#a855f7', '#06b6d4',
]

const ADJECTIVES = ['Swift', 'Bright', 'Calm', 'Bold', 'Keen', 'Wise', 'Cool', 'Zany']
const NOUNS      = ['Panda', 'Falcon', 'Otter', 'Tiger', 'Lynx', 'Raven', 'Wolf', 'Fox']

function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${a} ${n}`
}

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || [] } catch { return [] }
}

function saveRecent(id) {
  const prev = loadRecent().filter((r) => r.id !== id)
  const next = [{ id, ts: Date.now() }, ...prev].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

function formatAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── Floating particles canvas ──────────────────────────────────────────────
function ParticlesBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COUNT = 55
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.1,
      color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x += p.dx
        p.y += p.dy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Draw faint connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = '#6366f1'
            ctx.globalAlpha = (1 - dist / 100) * 0.12
            ctx.lineWidth = 0.8
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="particles-canvas" />
}

// ── Identity picker modal ──────────────────────────────────────────────────
function IdentityModal({ targetRoomId, onConfirm, onCancel }) {
  const stored = (() => {
    try { return JSON.parse(sessionStorage.getItem('tlc_user')) } catch { return null }
  })()

  const [name, setName]   = useState(stored?.name || randomName())
  const [color, setColor] = useState(stored?.color || AVATAR_COLORS[0])
  const [shake, setShake] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setShake(true); setTimeout(() => setShake(false), 500); return }
    onConfirm({ name: trimmed, color })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-avatar" style={{ background: color }}>
            {name.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="modal-title">Set your identity</p>
            <p className="modal-sub">How others will see you in the room</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="modal-label">Display name</label>
          <input
            autoFocus
            className={`modal-input ${shake ? 'modal-input--shake' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Your name…"
          />

          <label className="modal-label" style={{ marginTop: 12 }}>Pick a color</label>
          <div className="color-picker">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${color === c ? 'color-swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary modal-enter-btn">
              Enter Room →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const [joinId, setJoinId]       = useState('')
  const [copied, setCopied]       = useState(false)
  const [recent, setRecent]       = useState(loadRecent)
  const [modal, setModal]         = useState(null)   // null | roomId string
  const [visible, setVisible]     = useState(false)

  useEffect(() => {
    setRecent(loadRecent())
    // Trigger entrance animation
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const openModal = (roomId) => setModal(roomId)

  const handleConfirm = ({ name, color }) => {
    const stored = (() => {
      try { return JSON.parse(sessionStorage.getItem('tlc_user')) } catch { return null }
    })()
    const user = { id: stored?.id || uuidv4(), name, color, cursor: 0 }
    sessionStorage.setItem('tlc_user', JSON.stringify(user))
    saveRecent(modal)
    navigate(`/room/${modal}`)
  }

  const createRoom = () => {
    const id = uuidv4().slice(0, 8)
    openModal(id)
  }

  const joinRoom = (e) => {
    e.preventDefault()
    const id = joinId.trim()
    if (id) openModal(id)
  }

  const copyLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${id}`)
    setCopied(id)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="home-bg">
      <ParticlesBackground />

      <div className={`home-center ${visible ? 'home-center--visible' : ''}`}>
        {/* Logo / hero */}
        <div className="home-hero">
          <div className="home-logo-ring">
            <span className="home-logo-icon">∂</span>
          </div>
          <h1 className="home-title">
            <span className="home-title-tex">TeX</span>
            <span className="home-title-lite">Lite</span>
            <span className="home-title-collab">Collab</span>
          </h1>
          <p className="home-tagline">
            Real-time collaborative LaTeX editor &mdash; up to 4 authors, zero setup
          </p>
        </div>

        {/* Main card */}
        <div className="home-card-new">
          {/* Create */}
          <button className="create-btn" onClick={createRoom}>
            <span className="create-btn-icon">+</span>
            <span className="create-btn-text">
              <strong>Create New Room</strong>
              <small>Start a fresh LaTeX document</small>
            </span>
            <span className="create-btn-arrow">→</span>
          </button>

          <div className="home-divider">
            <span>or join existing</span>
          </div>

          {/* Join */}
          <form onSubmit={joinRoom} className="join-form-new">
            <input
              className="join-input"
              placeholder="Enter room ID…"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              spellCheck={false}
            />
            <button className="join-btn" type="submit" disabled={!joinId.trim()}>
              Join →
            </button>
          </form>

          {/* Recent rooms */}
          {recent.length > 0 && (
            <div className="recent-section">
              <p className="recent-label">Recent rooms</p>
              <div className="recent-list">
                {recent.map((r) => (
                  <div key={r.id} className="recent-row">
                    <div className="recent-dot" />
                    <button className="recent-room-id" onClick={() => openModal(r.id)}>
                      {r.id}
                    </button>
                    <span className="recent-time">{formatAgo(r.ts)}</span>
                    <button
                      className={`recent-link-btn ${copied === r.id ? 'recent-link-btn--copied' : ''}`}
                      title="Copy invite link"
                      onClick={() => copyLink(r.id)}
                    >
                      {copied === r.id ? '✓ Copied' : '🔗 Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feature pills */}
        <div className="feature-pills">
          {[
            { icon: '🔴', label: 'Live cursors' },
            { icon: '⚡', label: 'Auto-save' },
            { icon: '📦', label: 'PDF compile' },
            { icon: '🔗', label: 'No login' },
          ].map((f) => (
            <div key={f.label} className="feature-pill">
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <IdentityModal
          targetRoomId={modal}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
