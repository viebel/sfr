/*
 * The books left open, so a reload finds the desk as it was. Only library
 * books are kept: a file opened from disk lives in the page's memory and
 * cannot be fetched again from an id.
 *
 * A restored tab holds its place and its view but no document — it is loaded
 * when it is first brought forward, so coming back to five open books does not
 * pull five manuscripts over the network at once.
 */
const KEY = 'sfr.reader-session'
const MAX = 12

export function loadSession() {
  if (typeof window === 'undefined') return { docs: [], active: '' }
  try {
    const raw = window.localStorage.getItem(KEY)
    const session = raw ? JSON.parse(raw) : null
    const docs = Array.isArray(session?.docs) ? session.docs.filter(d => d && d.bookId) : []
    return { docs: docs.slice(0, MAX), active: session?.active || '' }
  } catch {
    return { docs: [], active: '' }
  }
}

export function saveSession(session) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ docs: (session.docs || []).slice(0, MAX), active: session.active || '' })
    )
  } catch {
    /* private mode, quota — the reader works without a memory */
  }
}
