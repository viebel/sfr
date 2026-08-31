/*
 * How each book was being read, in localStorage: the page reached, and the
 * settings it was read with — binding direction, spread, fit, zoom, rotation.
 * Reopening a book puts all of it back rather than starting from the cover in
 * default settings.
 *
 * Only books of the library are remembered: a file opened from disk has no
 * stable identity to come back to, and its path is not ours to keep.
 */
const KEY = 'sfr.reading-history'
const MAX = 30

// Every setting that belongs to one book rather than to the reader as a whole.
// dirFrom records which declared direction the stored `dir` was settled
// against, so a later change in data/library.json can be told apart from the
// reader's own choice. See resolveDir in pages/library.js.
export const VIEW_KEYS = [
  'dir',
  'dirFrom',
  'spread',
  'coverAlone',
  'fitMode',
  'zoomIndex',
  'rotation'
]

export function pickView(source) {
  const view = {}
  VIEW_KEYS.forEach(k => {
    if (source && source[k] !== undefined) view[k] = source[k]
  })
  return view
}

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

// The page and the settings this book was last read with, if it ever was.
export function readingStateOf(id) {
  const entry = load().find(e => e.id === id)
  return { page: entry?.page || 0, view: entry?.view || null }
}

export function recordRead({ id, title, page, numPages, view }) {
  if (typeof window === 'undefined' || !id) return
  const list = load()
  const previous = list.find(e => e.id === id)
  save([
    {
      id,
      title,
      page,
      numPages,
      view: { ...(previous?.view || {}), ...pickView(view) },
      at: Date.now()
    },
    ...list.filter(e => e.id !== id)
  ])
}

export function forgetRead(id) {
  if (typeof window === 'undefined') return
  save(load().filter(e => e.id !== id))
}

export function clearHistory() {
  if (typeof window === 'undefined') return
  save([])
}
