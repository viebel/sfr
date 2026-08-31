import library from './library.json'

/*
 * The library holds no files: every book is an asset of a GitHub release, so
 * the repository stays small whatever a scan weighs and GitHub's 100 MB file
 * limit stops being a constraint.
 *
 * Adding one:  yarn book mon-livre.pdf   (compresses if needed, uploads, and
 * writes the entry below) — then commit data/library.json.
 *
 * A release asset answers without any `access-control-allow-origin` header, so
 * the browser cannot fetch it directly: pages/api/book/[id].js proxies it from
 * our own origin, forwarding the Range requests pdf.js relies on.
 */
export const RELEASE_TAG = library.release

export const books = library.books

// Where the proxy goes to fetch a book.
export function releaseAssetUrl(file) {
  return `https://github.com/viebel/sfr/releases/download/${RELEASE_TAG}/${encodeURIComponent(file)}`
}

// What the reader loads: our own origin, so no CORS is involved.
export function bookHref(book) {
  return `/api/book/${encodeURIComponent(book.id)}`
}
