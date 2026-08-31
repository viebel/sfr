import { Readable } from 'stream'
import { books, releaseAssetUrl } from '../../../data/books'

/*
 * Node, not edge. The edge runtime answers every response chunked, and drops
 * the `content-length` it was handed; pdf.js reads exactly that header on its
 * first request to decide whether the file can be read in pieces. Without it
 * the reader gives up on ranges and pulls all 46 MB before drawing page 1.
 *
 * Nothing is buffered here either: the upstream body is piped straight to the
 * response, and with `disableStream` on the reader side (see pages/library.js)
 * this first request is cancelled as soon as its headers arrive — everything
 * after it is a range of a few hundred kilobytes.
 */
export const config = { api: { responseLimit: false } }

export default async function handler(req, res) {
  const id = decodeURIComponent(String(req.query.id || ''))
  const book = books.find(b => b.id === id)
  if (!book) {
    res.status(404).end('Unknown book')
    return
  }

  // pdf.js asks for byte ranges so it can render page 40 without reading the
  // first 39; the range has to reach GitHub for that to stay true here.
  const range = req.headers.range
  const upstream = await fetch(releaseAssetUrl(book.file), {
    headers: range ? { Range: range } : {},
    redirect: 'follow'
  })
  if (!upstream.ok && upstream.status !== 206) {
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
  // must let go of the upstream body rather than keep draining GitHub.
  const body = Readable.fromWeb(upstream.body)
  res.on('close', () => body.destroy())
  body.pipe(res)
}
