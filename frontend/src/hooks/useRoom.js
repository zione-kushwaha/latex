import { useEffect, useRef, useState, useCallback } from 'react'
import {
  joinRoom, leaveRoom, subscribeRoom, subscribeFiles,
  updateFileContent, setEditingBy, setCachedUsers,
} from '../lib/room'
import { getOrCreateUser } from '../lib/user'

const SAVE_MS = 1000
const LOCK_MS = 1500

export const SYNC = {
  TYPING:  'tlc:typing',
  SAVING:  'tlc:saving',
  SAVED:   'tlc:saved',
  ERROR:   'tlc:saveerror',
}

function emit(type, detail = {}) {
  window.dispatchEvent(new CustomEvent(type, { detail }))
}

export function useRoom(roomId) {
  const [files, setFiles]               = useState({})
  const [users, setUsers]               = useState([])
  const [activeFileId, setActiveFileId] = useState('main')
  const [error, setError]               = useState(null)
  const [joined, setJoined]             = useState(false)
  const [localMode, setLocalMode]       = useState(false)
  // Set of fileIds that have local edits not yet pushed to Firestore
  const [dirtyFiles, setDirtyFiles]     = useState(new Set())

  const user            = useRef(getOrCreateUser())
  const saveTimer       = useRef(null)
  const typingTimer     = useRef(null)
  const typingLock      = useRef(false)
  const activeFileIdRef = useRef('main')
  const localModeRef    = useRef(false)
  const unsubRoom       = useRef(null)
  const unsubFiles      = useRef(null)
  // Keep latest files in a ref so push callbacks always see fresh content
  const filesRef        = useRef({})

  useEffect(() => { activeFileIdRef.current = activeFileId }, [activeFileId])
  useEffect(() => { localModeRef.current    = localMode },    [localMode])
  useEffect(() => { filesRef.current        = files },        [files])

  useEffect(() => {
    if (!roomId) return

    joinRoom(roomId, user.current)
      .then((result) => {
        if (!result.ok) { setError(result.error); return }
        setJoined(true)

        unsubRoom.current = subscribeRoom(roomId, (data) => {
          setCachedUsers(data.users || [])
          setUsers(data.users || [])
        })

        unsubFiles.current = subscribeFiles(roomId, (filesMap) => {
          setFiles((prev) => {
            const next = { ...filesMap }
            const aid  = activeFileIdRef.current
            // While typing OR in local mode: keep our local version for active file
            if ((typingLock.current || localModeRef.current) && prev[aid]) {
              next[aid] = { ...next[aid], content: prev[aid].content }
            }
            // For all dirty files in local mode: keep local content
            if (localModeRef.current) {
              setDirtyFiles((dirty) => {
                dirty.forEach((fid) => {
                  if (prev[fid]) next[fid] = { ...next[fid], content: prev[fid].content }
                })
                return dirty
              })
            }
            return next
          })
        })
      })
      .catch((err) => setError(err.message))

    const handleUnload = () => leaveRoom(roomId, user.current)
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      clearTimeout(saveTimer.current)
      clearTimeout(typingTimer.current)
      unsubRoom.current?.()
      unsubFiles.current?.()
      leaveRoom(roomId, user.current)
    }
  }, [roomId])

  const switchFile = useCallback((fileId) => {
    setEditingBy(roomId, activeFileIdRef.current, null)
    setEditingBy(roomId, fileId, user.current)
    setActiveFileId(fileId)
    typingLock.current = false
    clearTimeout(saveTimer.current)
    clearTimeout(typingTimer.current)
  }, [roomId])

  const handleContentChange = useCallback((newContent) => {
    if (newContent.length > 900_000) {
      emit(SYNC.ERROR, { msg: 'Document too large (900KB limit reached)' })
      return
    }

    const aid = activeFileIdRef.current

    // Always update local state immediately
    setFiles((prev) => ({
      ...prev,
      [aid]: { ...prev[aid], content: newContent },
    }))

    typingLock.current = true
    emit(SYNC.TYPING)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => { typingLock.current = false }, LOCK_MS)

    if (localModeRef.current) {
      // Local mode: mark file as dirty, do NOT write to Firestore
      setDirtyFiles((prev) => new Set([...prev, aid]))
      return
    }

    // Normal mode: debounced auto-save to Firestore
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      emit(SYNC.SAVING)
      updateFileContent(roomId, aid, newContent)
        .then(() => emit(SYNC.SAVED))
        .catch((e) => {
          emit(SYNC.ERROR, { msg: e.message })
        })
    }, SAVE_MS)
  }, [roomId])

  // Push a single file to Firestore
  const pushFile = useCallback(async (fileId) => {
    const file = filesRef.current[fileId]
    if (!file) return
    emit(SYNC.SAVING)
    try {
      await updateFileContent(roomId, fileId, file.content)
      setDirtyFiles((prev) => {
        const next = new Set(prev)
        next.delete(fileId)
        return next
      })
      emit(SYNC.SAVED)
    } catch (e) {
      emit(SYNC.ERROR, { msg: e.message })
    }
  }, [roomId])

  // Push all dirty files to Firestore at once
  const pushAll = useCallback(async () => {
    const dirty = [...dirtyFiles]
    if (!dirty.length) return
    emit(SYNC.SAVING)
    try {
      await Promise.all(dirty.map((fid) => {
        const file = filesRef.current[fid]
        return file ? updateFileContent(roomId, fid, file.content) : Promise.resolve()
      }))
      setDirtyFiles(new Set())
      emit(SYNC.SAVED)
    } catch (e) {
      emit(SYNC.ERROR, { msg: e.message })
    }
  }, [roomId, dirtyFiles])

  // Toggle local mode — when turning OFF, push all dirty files automatically
  const toggleLocalMode = useCallback(async () => {
    const turning_off = localModeRef.current
    setLocalMode((v) => !v)
    if (turning_off) {
      // Give state a tick to update, then push all dirty
      setTimeout(() => pushAll(), 50)
    }
  }, [pushAll])

  const handleCursorChange = useCallback(() => {}, [])

  const activeFile = files[activeFileId] ?? null
  const content    = activeFile?.content ?? ''

  return {
    files, users, activeFileId, activeFile, content,
    currentUser: user.current,
    error, joined,
    localMode, dirtyFiles,
    switchFile, handleContentChange, handleCursorChange,
    pushFile, pushAll, toggleLocalMode,
  }
}
