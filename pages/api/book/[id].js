import { Readable } from 'stream'
import { books, releaseAssetUrl } from '../../../data/books'

/*
 * Node, not edge. The edge runtime answers every response chunked and drops the
 * `content-length` it was handed; pdf.js reads exactly that header on its first
 * request to decide whether a file can be read in pieces at all. Without it the
 * reader gives up on ranges and pulls a whole scan down before drawing a page.
 */
export const config = { api: { responseLimit: false } }

/*
 * github.com/…/releases/download/… does not hold the file: it answers 302 with
 * a signed URL on a blob host, good for about an hour. Reading a book is a lot
 * of ranges, and paying that redirect — a second DNS lookup, a second TLS
 * handshake — on every one of them is most of what opening a book used to cost.
 * So the signed URL is resolved once per book and kept until it expires.
 */
const signed = new Map()

function expiryOf(url) {
  // The signature carries its own deadline in `se`; a minute of margin covers
  // the time between handing the URL out and the range arriving upstream.
  const se = new URL(url).searchParams.get('se')
  const at = se ? Date.parse(se) : NaN
  return Number.isFinite(at) ? at - 60_000 : Date.now() + 10 * 60_000
}

async function assetUrl(book, force = false) {
  const cached = signed.get(book.id)
  if (!force && cached && cached.expires > Date.now()) return cached.url

  const res = await fetch(releaseAssetUrl(book.file), { redirect: 'manual' })
  const location = res.headers.get('location')
  res.body?.cancel()
  if (!location) return releaseAssetUrl(book.file) // no redirect: use it as is
  signed.set(book.id, { url: location, expires: expiryOf(location) })
  return location
}

// One fetch upstream, with the signature refreshed if it expired mid-read.
async function upstreamFetch(book, range) {
  const headers = range ? { Range: range } : {}
  let res = await fetch(await assetUrl(book), { headers, redirect: 'follow' })
  if (res.status === 401 || res.status === 403) {
    res.body?.cancel()
    res = await fetch(await assetUrl(book, true), { headers, redirect: 'follow' })
  }
  return res
}

export default async function handler(req, res) {
  const id = decodeURIComponent(String(req.query.id || ''))
  const book = books.find(b => b.id === id)
  if (!book) {
    res.status(404).end('Unknown book')
    return
  }

  const upstream = await upstreamFetch(book, req.headers.range)
  if (!upstream.ok && upstream.status !== 206) {
    upstream.body?.cancel()
    res.status(502).end('Upstream error')
    return
  }

  res.statusCode = upstream.status
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Disposition', `inline; filename="${book.file}"`)
  // A release asset never changes under the same tag — a new book means a new
  // upload, so the whole file can be cached hard. A slice of it is only cached
  // in the browser, which keys it by range; a shared cache does not, and would
  // hand the next reader someone else's bytes.
  res.setHeader(
    'Cache-Control',
    upstream.status === 206
      ? 'public, max-age=3600'
      : 'public, max-age=3600, s-maxage=31536000, immutable'
  )
  for (const h of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const v = upstream.headers.get(h)
    if (v) res.setHeader(h, v)
  }

  // A cancelled range — the reader turned the page before this one arrived —
  // must let go of the upstream body rather than keep draining the blob host,
  // and the abort it raises here is the expected end of that range, not a fault.
  const body = Readable.fromWeb(upstream.body)
  body.on('error', () => res.destroy())
  res.on('close', () => body.destroy())
  body.pipe(res)
}
