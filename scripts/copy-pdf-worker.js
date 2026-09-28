/*
 * pdf.js is loaded straight from public/ rather than through the bundler:
 * Next treats pdfjs-dist as an ESM external, and bundling it breaks the client
 * bundle of any page that imports it. The worker, cMaps, standard fonts, wasm
 * and ICC profiles are all fetched by URL at runtime — without the cMaps and
 * standard fonts, non-Latin text (Hebrew) renders with the wrong glyphs.
 * Everything below is copied into public/pdfjs/, which is git-ignored.
 */
const fs = require('fs')
const path = require('path')

const root = path.dirname(require.resolve('pdfjs-dist/package.json'))
const targetDir = path.join(__dirname, '..', 'public', 'pdfjs')

const files = ['build/pdf.min.mjs', 'build/pdf.worker.min.mjs']
const dirs = ['cmaps', 'standard_fonts', 'wasm', 'iccs']

/*
 * The page count is taken from the file, not proved by reading it.
 *
 * pdf.js reads the catalog's /Count and then verifies it by walking to the last
 * page before it hands the document over. In a PDF whose page tree is one flat
 * list — what ghostscript and most scanners write — reaching page 488 of 488
 * means fetching the other 487 page objects, and those sit beside their own
 * page's image, spread across the whole file. So the cover cannot be drawn
 * until the last page has been found, and a 46 MB manuscript is read end to end
 * to show its first sheet: 46 MB and a minute, against 0.7 MB and a second.
 *
 * Deferring the walk instead of dropping it does not help: it then runs beside
 * the reading and takes every connection the browser will open, so the page
 * still arrives last. A desktop reader trusts /Count; so does this one.
 *
 * What it costs: a file whose /Count disagrees with its page tree — rare, and
 * the reason this check exists — will report the count it claims. Asking for a
 * page that is not there fails the way any missing page does, on that page,
 * rather than making every book pay to rule it out.
 */
/*
 * A page is found by its place in a flat list, not by reading the ones before it.
 *
 * To find page n, pdf.js walks the page tree from the top and opens every kid
 * it passes, to learn whether it is one page or a branch holding many. In a
 * flat tree that is every page before n — and on the top level it also starts
 * fetching all the kids at once, to have them ready. Each page object sits
 * beside its own scan, so each one costs a range request of its own: page 60 of
 * a 129-page manuscript read 123 ranges, 32 MB of a 44 MB file, before it drew.
 *
 * A node whose /Count equals the length of its /Kids is a list of pages, one
 * per kid: page n is kid n, and it is the only one fetched. Page 60 then costs
 * its own object and its own scan.
 *
 * What it costs: a node that counts the same but not one page per kid — a
 * branch of 0 beside a branch of 2 — would land on the wrong kid. The spec
 * forbids empty branches, and such a file will show the wrong page rather
 * than fail; /Count is trusted here as it is above.
 *
 * (e: the page index sought, l: pages passed so far, c: /Count, h: /Kids,
 * t: nodes still to visit — pdf.js's minified names in getPageDict.)
 */
const patches = [
  {
    file: 'pdf.worker.min.mjs',
    from: 'await this.ensureDoc("checkFirstPage",[e]);await this.ensureDoc("checkLastPage",[e])',
    to: 'await this.ensureDoc("checkFirstPage",[e])'
  },
  {
    file: 'pdf.worker.min.mjs',
    from: 'throw new FormatError("Page dictionary kids object is not an array.")}for(let e=h.length-1;e>=0;e--){const n=h[e];t.push(n);',
    to: 'throw new FormatError("Page dictionary kids object is not an array.")}if(c===h.length&&h.every(e=>e instanceof Ref)){t.push(h[e-l]);l=e;continue}for(let e=h.length-1;e>=0;e--){const n=h[e];t.push(n);'
  }
]

function patchFor(name) {
  return patches.filter(p => p.file === name)
}

function copyIfStale(source, target) {
  const wanted = patchFor(path.basename(target))
  const exists = fs.existsSync(target)
  // Older than the source, or copied before the patch existed. The second test
  // matters: the mtime says nothing about whether the copy was patched, and an
  // unpatched worker is silent — every heavy book is simply slow again.
  const stale =
    !exists ||
    fs.statSync(target).mtimeMs < fs.statSync(source).mtimeMs ||
    (wanted.length && wanted.some(p => fs.readFileSync(target, 'utf8').includes(p.from)))
  if (!stale) return 0

  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (!wanted.length) {
    fs.copyFileSync(source, target)
    return 1
  }

  let code = fs.readFileSync(source, 'utf8')
  for (const { from, to } of wanted) {
    // Loudly, not quietly: a pdf.js release that renames this leaves every
    // heavy book slow again, and a silent copy would hide it.
    if (!code.includes(from)) {
      throw new Error(
        `pdf.js patch no longer applies to ${path.basename(target)}: "${from}" not found. ` +
          `Find the code it patches in the new pdfjs-dist (the comments above the patches say what it does) and update scripts/copy-pdf-worker.js.`
      )
    }
    code = code.replace(from, to)
  }
  fs.writeFileSync(target, code)
  return 1
}

let copied = 0

for (const file of files) {
  copied += copyIfStale(path.join(root, file), path.join(targetDir, path.basename(file)))
}

for (const dir of dirs) {
  const from = path.join(root, dir)
  if (!fs.existsSync(from)) continue
  for (const entry of fs.readdirSync(from)) {
    copied += copyIfStale(path.join(from, entry), path.join(targetDir, dir, entry))
  }
}

if (copied) console.log(`copied ${copied} pdf.js asset(s) -> public/pdfjs/`)
