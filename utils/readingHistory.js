/*
 * Where the reader was left off, per book, in localStorage. Only books of the
 * library are remembered: a file opened from disk has no stable identity to
 * come back to, and its path is not ours to keep.
 */
const KEY = 'sfr.reading-history'
const MAX = 20

function load() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter(e => e && e.id) : []
  } catch {
    // A corrupt or unavailable store must never keep the reader from opening.
    return []
  }
}

function save(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* private mode, quota — reading still works without a memory */
  }
}

// Most recently read first.
export function readHistory() {
  return load().sort((a, b) => (b.at || 0) - (a.at || 0))
}

export function lastPageOf(id) {
  const entry = load().find(e => e.id === id)
  return entry?.page || 0
}

export function recordRead({ id, title, page, numPages }) {
  if (typeof window === 'undefined' || !id) return
  const list = load().filter(e => e.id !== id)
  list.unshift({ id, title, page, numPages, at: Date.now() })
  save(list)
}

export function forgetRead(id) {
  if (typeof window === 'undefined') return
  save(load().filter(e => e.id !== id))
}

export function clearHistory() {
  if (typeof window === 'undefined') return
  save([])
}
