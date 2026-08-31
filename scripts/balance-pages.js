/*
 * Makes a PDF openable without reading it whole.
 *
 * Before drawing anything, pdf.js walks to the last page to check the page
 * count it was given. Ghostscript writes a flat page tree — one /Pages node
 * with one child per page — and there is no way to reach child 488 of 488
 * except by fetching the other 487, which for a scan are spread evenly through
 * the file. So "open page 1" reads all 46 MB, and the reader waits for the
 * whole book however few bytes the page itself needs.
 *
 * Grouping the pages under intermediate /Pages nodes gives each subtree a
 * /Count, which is what lets pdf.js skip one without reading it. The nodes are
 * appended together at the end of the file, so walking to the last page costs
 * two or three reads instead of one per page. Measured on a 46 MB, 488-page
 * manuscript: 46 MB read before the first page, down to 1.3 MB.
 *
 * It is written as an incremental update — the original bytes are untouched
 * and the new objects are appended — so nothing is re-encoded and no page is
 * touched. Only files with a classic cross-reference table are handled; one
 * with a cross-reference stream is left alone, and says so.
 */
const fs = require('fs')

// Two levels, kept about as wide as they are deep: reaching the last page then
// costs one read for the nodes and one for the group it lands in.
function groupSize(count) {
  return Math.min(64, Math.max(8, Math.ceil(Math.sqrt(count))))
}

// Follows the /Prev chain from the last startxref, newest section first, so an
// object rewritten by an earlier incremental update keeps its latest offset.
function readXref(buf, start) {
  const offsets = new Map()
  const trailer = {}
  const seen = new Set()
  let at = start

  while (at !== null && !seen.has(at)) {
    seen.add(at)
    if (buf.slice(at, at + 4).toString('latin1') !== 'xref') return null
    let p = at + 4
    for (;;) {
      const head = /^\s*(\d+)\s+(\d+)\s*/.exec(buf.slice(p, p + 40).toString('latin1'))
      if (!head) break
      const first = Number(head[1])
      const count = Number(head[2])
      p += head[0].length
      for (let i = 0; i < count; i++) {
        const entry = buf.slice(p, p + 20).toString('latin1')
        p += 20
        if (entry[17] === 'n' && !offsets.has(first + i)) {
          offsets.set(first + i, Number(entry.slice(0, 10)))
        }
      }
    }
    const tail = /^\s*trailer\s*<<([\s\S]*?)>>\s*startxref/.exec(
      buf.slice(p, p + 4096).toString('latin1')
    )
    if (!tail) return null
    const dict = tail[1]
    const root = /\/Root\s+(\d+)\s+\d+\s+R/.exec(dict)
    if (root && !trailer.root) trailer.root = Number(root[1])
    const prev = /\/Prev\s+(\d+)/.exec(dict)
    at = prev ? Number(prev[1]) : null
  }
  return offsets.size ? { offsets, root: trailer.root } : null
}

function objectBody(buf, offset) {
  const head = /^\d+\s+\d+\s+obj\s*/.exec(buf.slice(offset, offset + 40).toString('latin1'))
  if (!head) return null
  const from = offset + head[0].length
  const end = buf.indexOf('endobj', from, 'latin1')
  return end === -1 ? null : buf.slice(from, end).toString('latin1')
}

/*
 * Returns what was done, so the caller can say it: { balanced, pages, groups }
 * when the file was rewritten, or { skipped: <reason> } when it was left as it
 * was. `target` may be `source` — the file is only written once it is built.
 */
function balancePages(source, target) {
  const buf = fs.readFileSync(source)
  const tail = buf.slice(-2048).toString('latin1')
  const marks = [...tail.matchAll(/startxref\s+(\d+)\s+%%EOF/g)]
  if (!marks.length) return { skipped: 'no startxref' }

  const xref = readXref(buf, Number(marks[marks.length - 1][1]))
  if (!xref || !xref.root) return { skipped: 'cross-reference stream' }

  const rootBody = objectBody(buf, xref.offsets.get(xref.root))
  const pagesRef = rootBody && /\/Pages\s+(\d+)\s+\d+\s+R/.exec(rootBody)
  if (!pagesRef) return { skipped: 'no page tree' }

  const pagesNum = Number(pagesRef[1])
  const pagesBody = objectBody(buf, xref.offsets.get(pagesNum))
  const kidsAt = pagesBody && pagesBody.indexOf('/Kids')
  if (!pagesBody || kidsAt === -1) return { skipped: 'no page tree' }

  const list = /\[([\s\S]*?)\]/.exec(pagesBody.slice(kidsAt))
  if (!list) return { skipped: 'no page tree' }
  const kids = [...list[1].matchAll(/(\d+)\s+\d+\s+R/g)].map(m => Number(m[1]))

  const size = groupSize(kids.length)
  if (kids.length <= size) return { skipped: 'already shallow' }
  // A tree someone else already grouped: its children are /Pages, not /Page.
  const firstKid = objectBody(buf, xref.offsets.get(kids[0]))
  if (firstKid && /\/Type\s*\/Pages\b/.test(firstKid)) return { skipped: 'already grouped' }

  const groups = []
  for (let i = 0; i < kids.length; i += size) groups.push(kids.slice(i, i + size))

  let next = Math.max(...xref.offsets.keys()) + 1
  const added = new Map() // object number → body
  const nodes = []
  for (const group of groups) {
    const num = next++
    nodes.push(num)
    const refs = group.map(k => `${k} 0 R`).join(' ')
    added.set(num, `<</Type/Pages/Parent ${pagesNum} 0 R/Count ${group.length}/Kids[${refs}]>>`)
  }
  // The pages keep their old /Parent, one level above where they now hang. It
  // is only read to inherit attributes a page did not set, and it still leads
  // to the same root, so what it inherits is unchanged.
  added.set(
    pagesNum,
    `<</Type/Pages/Count ${kids.length}/Kids[${nodes.map(n => `${n} 0 R`).join(' ')}]>>`
  )

  const parts = [buf]
  if (buf[buf.length - 1] !== 0x0a) parts.push(Buffer.from('\n'))
  let at = parts.reduce((n, b) => n + b.length, 0)
  const written = new Map()
  for (const num of [...added.keys()].sort((a, b) => a - b)) {
    written.set(num, at)
    const chunk = Buffer.from(`${num} 0 obj\n${added.get(num)}\nendobj\n`, 'latin1')
    parts.push(chunk)
    at += chunk.length
  }

  // One subsection per object: the numbers are not contiguous, and a wrong
  // subsection header is the one mistake a reader cannot recover from.
  let table = 'xref\n'
  for (const num of [...written.keys()].sort((a, b) => a - b)) {
    table += `${num} 1\n${String(written.get(num)).padStart(10, '0')} 00000 n \n`
  }
  table += `trailer\n<</Size ${next}/Root ${xref.root} 0 R/Prev ${marks[marks.length - 1][1]}>>\n`
  table += `startxref\n${at}\n%%EOF\n`
  parts.push(Buffer.from(table, 'latin1'))

  fs.writeFileSync(target, Buffer.concat(parts))
  return { balanced: true, pages: kids.length, groups: groups.length }
}

/*
 * How much of the file the reader has to pull down before it can draw page 1,
 * asked of pdf.js itself rather than guessed from the shape of the tree. The
 * book is served over a loopback socket that answers byte ranges, which is the
 * only thing pages/api/book does that matters here.
 *
 * Guessing does not work: a flat tree is the usual cause of a book that has to
 * be read whole, but a file whose pages sit in compressed object streams comes
 * out fine with a tree this script cannot even parse. So it is measured.
 */
async function pageOneCost(file) {
  const http = require('http')
  const size = fs.statSync(file).size
  let read = 0

  const server = http.createServer((req, res) => {
    const asked = req.headers.range
    let start = 0
    let end = size - 1
    if (asked) {
      const [from, to] = asked.replace('bytes=', '').split('-')
      start = Number(from)
      end = to ? Math.min(Number(to), size - 1) : size - 1
      read += end - start + 1
    }
    res.statusCode = asked ? 206 : 200
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', end - start + 1)
    if (asked) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
    const body = fs.createReadStream(file, { start, end })
    res.on('close', () => body.destroy())
    body.on('error', () => {})
    body.pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = pdfjs.getDocument({
      url: `http://127.0.0.1:${server.address().port}/book.pdf`,
      disableStream: true,
      disableAutoFetch: true,
      rangeChunkSize: 256 * 1024
    })
    const pdf = await task.promise
    await (await pdf.getPage(1)).getOperatorList()
    await task.destroy()
  } catch {
    return { read: size, size, share: 1 } // unreadable this way: assume the worst
  } finally {
    server.close()
  }
  return { read, size, share: read / size }
}

/*
 * `node scripts/balance-pages.js <file.pdf>` groups the file's pages in place
 * and prints, as JSON, what was done and what it now costs to open. Run as a
 * child process by scripts/add-book.js, which stays synchronous that way.
 */
async function main() {
  const file = process.argv[2]
  const tree = balancePages(file, file)
  const cost = await pageOneCost(file)
  // Under a fifth of the book, or under two megabytes: either way the reader
  // gains by asking for ranges instead of pulling the file down in one piece.
  const lazy = cost.share < 0.2 || cost.read < 2 * 1024 * 1024
  process.stdout.write(JSON.stringify({ ...tree, ...cost, lazy }))
}

module.exports = { balancePages, pageOneCost }

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(String(err && err.message))
    process.exit(1)
  })
}
