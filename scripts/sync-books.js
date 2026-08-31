#!/usr/bin/env node
/*
 * yarn books
 *
 * Publishes everything sitting in books/ and manuscripts/ that is not in the
 * library yet: compresses what is too heavy, uploads it to the GitHub release,
 * and writes its line in data/library.json. Both folders are git-ignored — they
 * are the desk, the release is the shelf.
 *
 * The folder decides the shelf: books/ holds printed books, manuscripts/ holds
 * manuscripts.
 *
 * Options:
 *   --force     publish again even what is already there
 *   --max 40    megabytes above which a file is compressed (default: 20)
 *   --as-is     never compress, whatever a file weighs
 *   --dry-run   say what would happen, upload nothing
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const { addBook, readManifest, writeManifest, slug, has, sourceName } = require('./add-book')

const root = path.join(__dirname, '..')
const folders = [
  { dir: 'books', kind: 'book' },
  { dir: 'manuscripts', kind: 'manuscript' }
]

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return /\.pdf$/i.test(entry.name) ? [full] : []
  })
}

function releaseAssets(tag) {
  try {
    const out = execFileSync('gh', ['release', 'view', tag, '--json', 'assets'], {
      encoding: 'utf8'
    })
    return new Set(JSON.parse(out).assets.map(a => a.name))
  } catch {
    console.warn(`⚠ cannot read release ${tag} — going by the manifest alone`)
    return null
  }
}

/*
 * A file counts as published when the manifest knows it under any of the three
 * names it can be known by: the id derived from its name, the file name it was
 * uploaded from, or the title. The hand-picked ids of the books published
 * before this script existed are recognised by the last two.
 */
function published(manifest, assets, file) {
  const from = sourceName(file)
  const base = path.basename(file).normalize('NFC')
  const title = path.basename(file, path.extname(file)).normalize('NFC')
  // Exact first: books/ and manuscripts/ both hold a ספר המספר, and a title
  // match would hand back whichever of the two the manifest happens to list
  // first.
  const entry =
    manifest.books.find(b => b.source === from) ||
    manifest.books.find(b => b.id === slug(title) || b.source === base || b.title === title)
  if (!entry) return null
  if (assets && !assets.has(entry.file)) return null // in the manifest, gone from the release
  return entry
}

function main() {
  const argv = process.argv.slice(2)
  const force = argv.includes('--force')
  const dryRun = argv.includes('--dry-run')
  const maxIndex = argv.indexOf('--max')
  const asIs = argv.includes('--as-is') || argv.includes('--no-compress')
  const max = asIs ? Infinity : maxIndex >= 0 ? parseFloat(argv[maxIndex + 1]) : 20

  if (!has('gh')) {
    console.error('gh is required to upload to the release (brew install gh)')
    process.exit(1)
  }

  const manifest = readManifest()
  const assets = releaseAssets(manifest.release)

  const found = folders.flatMap(({ dir, kind }) => {
    // Both are git-ignored, so a fresh clone has neither: make them rather than
    // making the reader wonder where to drop a PDF.
    fs.mkdirSync(path.join(root, dir), { recursive: true })
    return walk(path.join(root, dir)).map(file => ({ file, kind, dir }))
  })
  if (!found.length) {
    console.log('Nothing to publish: books/ and manuscripts/ hold no PDF.')
    return
  }

  let added = 0
  const skipped = []
  for (const { file, kind, dir } of found) {
    const already = force ? null : published(manifest, assets, file)
    if (already) {
      skipped.push(`${path.relative(root, file)} → ${already.id}`)
      continue
    }
    if (addBook(manifest, file, { kind }, { max, dryRun })) added++
  }

  if (skipped.length) {
    console.log(`\nAlready in the library (${skipped.length}):`)
    skipped.forEach(line => console.log(`  · ${line}`))
  }

  if (!added) {
    console.log('\nNothing new to publish.')
    return
  }
  if (dryRun) {
    console.log(`\n(dry run) ${added} book(s) would have been published.`)
    return
  }

  writeManifest(manifest)
  console.log(`\n${added} book(s) published. data/library.json updated — left to do:`)
  console.log('  git add data/library.json && git commit -m "Add books" && git push')
}

main()
