#!/usr/bin/env node
/*
 * yarn book <fichier.pdf> [...]
 *
 * Puts a PDF in the library: compresses it if it is too heavy to read over the
 * network, uploads it as an asset of the GitHub release, and records it in
 * data/library.json. Nothing goes into git but that one line of manifest.
 *
 * Options (apply to the file that follows them):
 *   --title "ספר יצירה"   displayed name          (default: the file name)
 *   --author "ר׳ …"       displayed under it
 *   --year 1284           displayed next to the author
 *   --kind manuscript     shelf: book (default) or manuscript
 *   --dir rtl|ltr         reading direction       (default: guessed from title)
 *   --id my-book          stable id for /library?book=…  (default: from title)
 *   --max 20              megabytes above which it is compressed (default: 20)
 *   --keep                keep the compressed file next to the original
 *   --dry-run             say what would happen, upload nothing
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const manifestPath = path.join(root, 'data', 'library.json')
const MB = 1024 * 1024

/*
 * Each pass re-encodes the images and caps their resolution; the cap is read
 * against the page size the PDF declares, which is why a scan that calls itself
 * 72 dpi only starts shrinking near the bottom of this list. The first pass
 * that comes in under the target wins, so a book is never squeezed harder than
 * it needs to be.
 */
const passes = [
  { jpeg: 65, dpi: 200 },
  { jpeg: 60, dpi: 150 },
  { jpeg: 55, dpi: 110 },
  { jpeg: 50, dpi: 72 },
  { jpeg: 45, dpi: 50 }
]

const hebrew = {
  א: '', ב: 'b', ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'h', ט: 't', י: 'y',
  כ: 'k', ך: 'k', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', ע: '', פ: 'p',
  ף: 'p', צ: 'ts', ץ: 'ts', ק: 'q', ר: 'r', ש: 'sh', ת: 't'
}

function slug(name) {
  const latin = [...name.normalize('NFD')]
    .map(ch => (hebrew[ch] !== undefined ? hebrew[ch] : ch))
    .join('')
    .replace(/[̀-ͯ]/g, '') // the accents NFD just split off
  return (
    latin
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'book'
  )
}

function guessDir(title) {
  return /[֐-׿؀-ۿ]/.test(title) ? 'rtl' : 'ltr'
}

function has(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function readManifest() {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  raw.books = Array.isArray(raw.books) ? raw.books : []
  return raw
}

function writeManifest(manifest) {
  manifest.books.sort((a, b) => a.title.localeCompare(b.title, 'he'))
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

function compress(source, target, { jpeg, dpi }) {
  execFileSync(
    'gs',
    [
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      '-dFastWebView=true', // so pdf.js can show page 400 without reading 399
      '-dDetectDuplicateImages=true',
      '-dPassThroughJPEGImages=false', // otherwise gs copies the JPEGs untouched
      '-dAutoFilterGrayImages=false',
      '-sGrayImageFilter=DCTEncode',
      '-dAutoFilterColorImages=false',
      '-sColorImageFilter=DCTEncode',
      `-dJPEGQ=${jpeg}`,
      '-dDownsampleGrayImages=true',
      `-dGrayImageResolution=${dpi}`,
      '-dGrayImageDownsampleThreshold=1.0',
      '-dGrayImageDownsampleType=/Bicubic',
      '-dDownsampleColorImages=true',
      `-dColorImageResolution=${dpi}`,
      '-dColorImageDownsampleThreshold=1.0',
      '-dColorImageDownsampleType=/Bicubic',
      '-o',
      target,
      source
    ],
    // ghostscript narrates the linearisation pass on stderr; the exception it
    // throws on a real failure carries that output anyway
    { stdio: ['ignore', 'ignore', 'pipe'] }
  )
  return fs.statSync(target).size
}

function shrink(source, maxBytes, keep) {
  const size = fs.statSync(source).size
  if (size <= maxBytes) return { file: source, size, passes: 0 }
  if (!has('gs')) {
    console.warn(
      `  ⚠ ${(size / MB).toFixed(0)} MB and ghostscript is missing — uploading as is (brew install ghostscript)`
    )
    return { file: source, size, passes: 0 }
  }

  const dir = keep ? path.dirname(source) : fs.mkdtempSync(path.join(os.tmpdir(), 'sfr-book-'))
  let best = { file: source, size, passes: 0 }
  for (const [i, pass] of passes.entries()) {
    const target = path.join(dir, `${slug(path.basename(source, '.pdf'))}-q${pass.jpeg}.pdf`)
    const got = compress(source, target, pass)
    console.log(
      `  · JPEG ${pass.jpeg}, ${pass.dpi} dpi → ${(got / MB).toFixed(1)} MB` +
        ` (${Math.round((100 * got) / size)}% of the original)`
    )
    if (got < best.size) best = { file: target, size: got, passes: i + 1 }
    if (got <= maxBytes) break
    // Re-encoding made it heavier: this document has nothing to give, and the
    // passes below only cost time.
    if (i === 0 && got >= size) break
  }
  if (best.size >= size) return { file: source, size, passes: 0 }
  return best
}

function pdfPages(file) {
  if (!has('gs')) return 0
  try {
    const out = execFileSync('gs', [
      '-q',
      '-dNODISPLAY',
      '-dNOSAFER',
      '-c',
      `(${file}) (r) file runpdfbegin pdfpagecount = quit`
    ])
    return parseInt(String(out).trim(), 10) || 0
  } catch {
    return 0
  }
}

function parse(argv) {
  const jobs = []
  let pending = {}
  let max = 20
  let keep = false
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--keep') keep = true
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--max') max = parseFloat(argv[++i])
    else if (arg.startsWith('--')) pending[arg.slice(2)] = argv[++i]
    else {
      jobs.push({ file: arg, meta: pending })
      pending = {}
    }
  }
  return { jobs, max, keep, dryRun }
}

function main() {
  const { jobs, max, keep, dryRun } = parse(process.argv.slice(2))
  if (!jobs.length) {
    console.error('Usage: yarn book [--title "…"] [--kind manuscript] <file.pdf> […]')
    process.exit(1)
  }
  if (!has('gh')) {
    console.error('gh is required to upload to the release (brew install gh)')
    process.exit(1)
  }

  const manifest = readManifest()
  for (const job of jobs) {
    addBook(manifest, job.file, job.meta, { max, keep, dryRun })
  }

  if (!dryRun) {
    writeManifest(manifest)
    console.log(`\ndata/library.json updated — left to do:`)
    console.log(`  git add data/library.json && git commit -m "Add books" && git push`)
  }
}

/*
 * Publishes one PDF and records it in the manifest, which it mutates. Shared
 * with scripts/sync-books.js, which walks the two folders and calls this for
 * everything not already published.
 */
function addBook(manifest, filePath, meta = {}, { max = 20, keep = false, dryRun = false } = {}) {
  const source = path.resolve(filePath)
  if (!fs.existsSync(source) || !/\.pdf$/i.test(source)) {
    console.error(`✗ ${filePath}: not found, or not a PDF`)
    process.exitCode = 1
    return null
  }

  const original = path.basename(source, path.extname(source)).normalize('NFC')
  const title = (meta.title || original).normalize('NFC')
  const id = meta.id || slug(title)
  const asset = `${id}.pdf`
  const tag = manifest.release

  console.log(`\n${title}`)
  const { file, size, passes: used } = shrink(source, max * MB, keep)
  if (used) console.log(`  ✓ compressed in ${used} pass(es): ${(size / MB).toFixed(1)} MB`)
  else console.log(`  · ${(size / MB).toFixed(1)} MB, uploaded as is`)

  // GitHub names the asset after the file, so it is uploaded under the id —
  // the accented, spaced, Hebrew original name would not survive the URL.
  const upload = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sfr-asset-')), asset)
  fs.copyFileSync(file, upload)

  if (dryRun) {
    console.log(`  · (dry run) gh release upload ${tag} ${asset}`)
  } else {
    execFileSync('gh', ['release', 'upload', tag, upload, '--clobber'], { stdio: 'inherit' })
    console.log(`  ✓ uploaded to release ${tag} as ${asset}`)
  }

  const entry = {
    id,
    file: asset,
    // what it was called on disk, so a second pass over the folder recognises
    // a book that was published under a hand-picked id
    source: path.basename(source).normalize('NFC'),
    title,
    author: meta.author || '',
    year: meta.year || '',
    kind: meta.kind === 'manuscript' ? 'manuscript' : 'book',
    dir: meta.dir || guessDir(title),
    pages: pdfPages(file) || undefined
  }
  const existing = manifest.books.findIndex(b => b.id === id)
  if (existing >= 0) manifest.books[existing] = { ...manifest.books[existing], ...entry }
  else manifest.books.push(entry)
  return entry
}

module.exports = { addBook, readManifest, writeManifest, slug, has }

if (require.main === module) main()
