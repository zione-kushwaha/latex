import {
  doc, getDoc, setDoc, updateDoc,
  onSnapshot, serverTimestamp,
  collection, deleteDoc, addDoc,
} from 'firebase/firestore'
import { db } from './firebase'

const MAX_USERS = 4

// Convert a logical path like "sections/introduction" → "sections__introduction"
// Firestore doc IDs cannot contain slashes
export function pathToId(path) {
  return path.replace(/\//g, '__')
}

// Convert back for display: "sections__introduction" → "sections/introduction"
export function idToPath(id) {
  return id.replace(/__/g, '/')
}

const DEFAULT_FILES = [
  {
    id: 'main',
    name: 'main.tex',
    folder: null,
    content: [
      '\\documentclass[12pt,a4paper]{article}',
      '\\usepackage{amsmath,amssymb}',
      '\\usepackage{geometry}',
      '\\usepackage{graphicx}',
      '\\usepackage{xcolor}',
      '\\usepackage{booktabs,float,caption}',
      '\\usepackage[colorlinks=true,linkcolor=blue,citecolor=blue,urlcolor=blue]{hyperref}',
      '\\geometry{margin=1in}',
      '',
      '\\title{My Document}',
      '\\author{TexLiteCollab}',
      '\\date{\\today}',
      '',
      '\\begin{document}',
      '\\maketitle',
      '\\tableofcontents',
      '\\newpage',
      '',
      '\\input{sections/introduction}',
      '\\input{sections/methods}',
      '\\input{sections/conclusion}',
      '',
      '\\end{document}',
    ].join('\n'),
  },
  {
    id: 'sections__introduction',
    name: 'introduction.tex',
    folder: 'sections',
    content: [
      '\\section{Introduction}',
      'Write your introduction here.',
      '',
      'This document is collaboratively edited using TexLiteCollab.',
    ].join('\n'),
  },
  {
    id: 'sections__methods',
    name: 'methods.tex',
    folder: 'sections',
    content: [
      '\\section{Methods}',
      'Describe your methods here.',
      '',
      '\\begin{equation}',
      '  E = mc^2',
      '\\end{equation}',
    ].join('\n'),
  },
  {
    id: 'sections__conclusion',
    name: 'conclusion.tex',
    folder: 'sections',
    content: [
      '\\section{Conclusion}',
      'Write your conclusion here.',
    ].join('\n'),
  },
]

// ── Room operations ────────────────────────────────────────────────────────

export async function joinRoom(roomId, user) {
  const ref = doc(db, 'rooms', roomId)

  const snap = await Promise.race([
    getDoc(ref),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(
        'Firestore timeout — make sure Firestore Database is enabled in Firebase Console.'
      )), 10000)
    ),
  ])

  if (!snap.exists()) {
    await setDoc(ref, {
      lastUpdated: serverTimestamp(),
      users: [user],
    })
    // Create default files
    const filesRef = collection(db, 'rooms', roomId, 'files')
    for (const f of DEFAULT_FILES) {
      await setDoc(doc(filesRef, f.id), {
        name: f.name,
        folder: f.folder,
        content: f.content,
        lastUpdated: serverTimestamp(),
        editingBy: null,
      })
    }
    return { ok: true }
  }

  const data = snap.data()
  const users = data.users || []

  if (users.find((u) => u.id === user.id)) return { ok: true }
  if (users.length >= MAX_USERS) return { ok: false, error: 'Room is full (max 4 users).' }

  await updateDoc(ref, { users: [...users, user] })
  return { ok: true }
}

export async function leaveRoom(roomId, user) {
  try {
    const ref = doc(db, 'rooms', roomId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const users = (snap.data().users || []).filter((u) => u.id !== user.id)
    await updateDoc(ref, { users })
  } catch (e) {
    console.warn('leaveRoom error:', e.message)
  }
}

export function subscribeRoom(roomId, callback) {
  const ref = doc(db, 'rooms', roomId)
  return onSnapshot(ref,
    (snap) => { if (snap.exists()) callback(snap.data()) },
    (err) => console.error('subscribeRoom error:', err.message)
  )
}

// ── File operations ────────────────────────────────────────────────────────

export function subscribeFiles(roomId, callback) {
  const ref = collection(db, 'rooms', roomId, 'files')
  return onSnapshot(ref,
    (snap) => {
      const files = {}
      snap.forEach((d) => { files[d.id] = { id: d.id, ...d.data() } })
      callback(files)
    },
    (err) => console.error('subscribeFiles error:', err.message)
  )
}

export async function updateFileContent(roomId, fileId, content) {
  const ref = doc(db, 'rooms', roomId, 'files', fileId)
  await updateDoc(ref, { content, lastUpdated: serverTimestamp() })
}

export async function createFile(roomId, name, folder = null) {
  // Build a flat safe ID
  const baseName = name.replace(/\.tex$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const id = folder ? `${folder}__${baseName}` : baseName
  const filesRef = collection(db, 'rooms', roomId, 'files')
  await setDoc(doc(filesRef, id), {
    name: name.endsWith('.tex') ? name : `${name}.tex`,
    folder: folder || null,
    content: `% ${name}\n`,
    lastUpdated: serverTimestamp(),
    editingBy: null,
  })
  return id
}

export async function deleteFile(roomId, fileId) {
  if (fileId === 'main') return
  await deleteDoc(doc(db, 'rooms', roomId, 'files', fileId))
}

export async function renameFile(roomId, fileId, newName) {
  const ref = doc(db, 'rooms', roomId, 'files', fileId)
  await updateDoc(ref, {
    name: newName.endsWith('.tex') ? newName : `${newName}.tex`,
  })
}

export async function setEditingBy(roomId, fileId, user) {
  try {
    const ref = doc(db, 'rooms', roomId, 'files', fileId)
    await updateDoc(ref, {
      editingBy: user ? { id: user.id, name: user.name, color: user.color } : null,
    })
  } catch (e) { /* non-critical */ }
}

// ── Assets ─────────────────────────────────────────────────────────────────

export async function uploadAsset(roomId, name, base64, mimeType) {
  const ref = collection(db, 'rooms', roomId, 'assets')
  const docRef = await addDoc(ref, { name, base64, mimeType, uploadedAt: serverTimestamp() })
  return docRef.id
}

export function subscribeAssets(roomId, callback) {
  const ref = collection(db, 'rooms', roomId, 'assets')
  return onSnapshot(ref, (snap) => {
    const assets = []
    snap.forEach((d) => assets.push({ id: d.id, ...d.data() }))
    callback(assets)
  })
}

export async function deleteAsset(roomId, assetId) {
  await deleteDoc(doc(db, 'rooms', roomId, 'assets', assetId))
}

// ── User cursor ────────────────────────────────────────────────────────────

let _cachedUsers = []
export function setCachedUsers(users) { _cachedUsers = users }

export async function updateCursor(roomId, user, cursor) {
  try {
    const ref = doc(db, 'rooms', roomId)
    const users = _cachedUsers.map((u) =>
      u.id === user.id ? { ...u, cursor } : u
    )
    if (!users.find((u) => u.id === user.id)) return
    await updateDoc(ref, { users })
  } catch (e) { /* non-critical */ }
}
