#!/usr/bin/env node
/*
 * yarn book <file.pdf> [...]
 *
 * Puts a PDF in the library: uploads it as an asset of the GitHub release, as
 * it is, and records it in data/library.json. Nothing goes into git but that
 * one line of manifest.
 *
 * Options (apply to the file that follows them):
 *   --title "ספר יצירה"   displayed name          (default: the file name)
 *   --author "ר׳ …"       displayed under it
 *   --year 1284           displayed next to the author
 *   --kind manuscript     shelf: book (default) or manuscript
 *   --dir rtl|ltr         reading direction       (default: guessed from title)
 *   --id my-book          stable id for /library?book=…  (default: from title)
 *   --dry-run             say what would happen, upload nothing
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const manifestPath = path.join(root, 'data', 'library.json')
const MB = 1024 * 1024

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

// The name to remember a source file by: its path in the repo, or failing that
// (a PDF picked up from anywhere else) its bare name.
function sourceName(file) {
  const relative = path.relative(root, file)
  return (relative.startsWith('..') ? path.basename(file) : relative).normalize('NFC')
}

function parse(argv) {
  const jobs = []
  let pending = {}
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') dryRun = true
    else if (arg.startsWith('--')) pending[arg.slice(2)] = argv[++i]
    else {
      jobs.push({ file: arg, meta: pending })
      pending = {}
    }
  }
  return { jobs, dryRun }
}

function main() {
  const { jobs, dryRun } = parse(process.argv.slice(2))
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
    addBook(manifest, job.file, job.meta, { dryRun })
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
function addBook(manifest, filePath, meta = {}, { dryRun = false } = {}) {
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
  console.log(`  · ${(fs.statSync(source).size / MB).toFixed(1)} MB`)

  // GitHub names the asset after the file, so it is uploaded under the id —
  // the accented, spaced, Hebrew original name would not survive the URL.
  const upload = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sfr-asset-')), asset)
  fs.copyFileSync(source, upload)

  if (dryRun) {
    console.log(`  · (dry run) gh release upload ${tag} ${asset}`)
  } else {
    execFileSync('gh', ['release', 'upload', tag, upload, '--clobber'], { stdio: 'inherit' })
    console.log(`  ✓ uploaded to release ${tag} as ${asset}`)
  }

  const entry = {
    id,
    file: asset,
    // where it came from on disk, so a later sweep of the folders recognises a
    // book that was published under a hand-picked id. Relative to the repo when
    // it lives in it — books/ and manuscripts/ both hold a ספר המספר, and they
    // are not the same book.
    source: sourceName(source),
    title,
    author: meta.author || '',
    year: meta.year || '',
    kind: meta.kind === 'manuscript' ? 'manuscript' : 'book',
    dir: meta.dir || guessDir(title)
  }
  const existing = manifest.books.findIndex(b => b.id === id)
  if (existing >= 0) manifest.books[existing] = { ...manifest.books[existing], ...entry }
  else manifest.books.push(entry)
  return entry
}

module.exports = { addBook, readManifest, writeManifest, slug, has, sourceName }

if (require.main === module) main()
