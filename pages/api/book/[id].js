import { releaseAssetUrl, releaseBooks } from '../../../data/books'

// Edge, not Node: the body is streamed straight through, so a 40 MB scan never
// has to be buffered in the function.
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const id = decodeURIComponent(new URL(req.url).pathname.split('/').pop())
  const book = releaseBooks.find(b => b.id === id)
  if (!book) return new Response('Unknown book', { status: 404 })

  // pdf.js asks for byte ranges so it can render page 40 without reading the
  // first 39; the range has to reach GitHub for that to stay true here.
  const range = req.headers.get('range')
  const upstream = await fetch(releaseAssetUrl(book.file), {
    headers: range ? { Range: range } : {},
    redirect: 'follow'
  })
  if (!upstream.ok && upstream.status !== 206) {
    return new Response('Upstream error', { status: 502 })
  }

  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Accept-Ranges': 'bytes',
    // A release asset never changes under the same tag — a new book means a new
    // upload, so this can be cached hard, both by the CDN and by the browser.
    'Cache-Control': 'public, max-age=3600, s-maxage=31536000, immutable',
    'Content-Disposition': `inline; filename="${book.file}"`
  })
  for (const h of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }

  return new Response(upstream.body, { status: upstream.status, headers })
}
