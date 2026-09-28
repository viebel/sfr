/*
 * Files from this machine, kept so a link can name one.
 *
 * A browser never tells a page where a file it was handed lives — only its
 * name and its bytes — and a page could not read a path it was given anyway.
 * What Chrome and Edge do give is a handle: a reference to the file itself,
 * which can be stored and asked for the file again later. The handles are
 * kept in IndexedDB under a short id, and ?file=<id> in the address is that
 * id: it reopens the same file, in this browser on this machine, and nowhere
 * else.
 *
 * Reading through a stored handle needs the reader's leave again after the
 * page is reloaded, and the browser only asks for it on a click — so a file
 * reached by a link waits for one (see readLocalFile / grantLocalFile).
 */
const DB = 'sfr.local-files'
const STORE = 'handles'

export function canRememberFiles() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

function request(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function openDb() {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  return request(r)
}

async function withStore(mode, fn) {
  const db = await openDb()
  try {
    return await fn(db.transaction(STORE, mode).objectStore(STORE))
  } finally {
    db.close()
  }
}

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

// The id of this file: the one it already has if it was opened before, so
// opening the same file twice does not give it two links.
export async function rememberHandle(handle) {
  const [ids, handles] = await withStore('readonly', store =>
    Promise.all([request(store.getAllKeys()), request(store.getAll())])
  )
  for (let i = 0; i < handles.length; i++) {
    if (await handles[i].isSameEntry(handle)) return ids[i]
  }
  const id = newId()
  await withStore('readwrite', store => request(store.put(handle, id)))
  return id
}

async function recallHandle(id) {
  if (!id || typeof indexedDB === 'undefined') return null
  return (await withStore('readonly', store => request(store.get(id)))) || null
}

/*
 * The file behind an id: null when the id names nothing this browser holds;
 * { name, file: null } when it does but reading it needs a click first.
 */
export async function readLocalFile(id) {
  const handle = await recallHandle(id)
  if (!handle) return null
  const permission = await handle.queryPermission({ mode: 'read' })
  return {
    name: handle.name,
    file: permission === 'granted' ? await handle.getFile() : null
  }
}

// Must run from a click: the browser asks for leave only on a user gesture.
export async function grantLocalFile(id) {
  const handle = await recallHandle(id)
  if (!handle) return false
  return (await handle.requestPermission({ mode: 'read' })) === 'granted'
}
