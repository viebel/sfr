#!/usr/bin/env node
/*
 * yarn books
 *
 * Reconciles the two staging folders with the library: publishes what is new,
 * asking for its title and its binding, and asks what to do about a book whose
 * file has left the desk. Both folders are git-ignored — they are the desk, the
 * release is the shelf, and data/library.json is all that git carries of it.
 *
 * The folder decides the shelf: books/ holds printed books, manuscripts/ holds
 * manuscripts.
 *
 * Options:
 *   --force     publish again even what is already there
 *   --yes       take every default, ask nothing
 *   --dry-run   say what would happen, upload nothing
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const {
  addBook,
  readManifest,
  writeManifest,
  slug,
  has,
  sourceName,
  pdfTitle,
  guessDir
} = require('./add-book')

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
 * A file counts as published when the manifest knows it under any of the names
 * it can be known by: the path it was published from, the id derived from its
 * name, or its title. The books published by hand before this script existed
 * are recognised by the last two.
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

/*
 * Questions, one line each, with the answer to press enter for in brackets. A
 * stream that ends — a pipe, a cron — answers every one of them with its
 * default rather than hanging.
 */
function prompter(auto) {
  if (auto) return { ask: async (_, fallback) => fallback, close() {} }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY)
  })
  // One line consumed per question, whether they are typed or piped in.
  const lines = rl[Symbol.asyncIterator]()
  return {
    async ask(question, fallback) {
      process.stdout.write(question)
      const { value, done } = await lines.next()
      if (done) {
        process.stdout.write(`${fallback}\n`)
        return fallback
      }
      return (value || '').trim() || fallback
    },
    close: () => rl.close()
  }
}

// What to call a new book and which way it is bound. The PDF's own title is
// offered when it has one worth offering. The id its link will carry follows
// from the title — it is only ever the title transliterated, so there is
// nothing to decide about it.
async function describe(prompt, file, kind) {
  const size = fs.statSync(file).size / (1024 * 1024)
  console.log(`\n${path.relative(root, file)}  (${size.toFixed(1)} MB, ${kind})`)

  const fromName = path.basename(file, path.extname(file)).normalize('NFC')
  const fromPdf = pdfTitle(file)
  let title
  if (fromPdf && fromPdf !== fromName) {
    console.log(`  1) ${fromName}   (file name)`)
    console.log(`  2) ${fromPdf}   (from the PDF)`)
    const choice = await prompt.ask('  title — 1, 2, or type another [1]: ', '1')
    title = choice === '1' ? fromName : choice === '2' ? fromPdf : choice
  } else {
    title = await prompt.ask(`  title [${fromName}]: `, fromName)
  }

  const dir = await prompt.ask(`  reading direction [${guessDir(title)}]: `, guessDir(title))

  return { title, dir: dir === 'ltr' ? 'ltr' : 'rtl', id: slug(title), kind }
}

/*
 * A book whose file has left the desk. Keeping it is the usual answer — the
 * local copy is not needed once the book is on the shelf — so that answer is
 * remembered, and the question is not asked about that book again.
 */
async function settleMissing(prompt, manifest, entry, dryRun) {
  console.log(`\n${entry.title}`)
  console.log(`  · published from ${entry.source}, which is not there any more`)
  const answer = await prompt.ask('  [k]eep in the library, or [r]emove it? [k]: ', 'k')

  if (answer.toLowerCase()[0] !== 'r') {
    entry.detached = true
    console.log('  · kept — not asked about again')
    return false
  }

  if (dryRun) {
    console.log(`  · (dry run) gh release delete-asset ${manifest.release} ${entry.file}`)
  } else {
    try {
      execFileSync('gh', ['release', 'delete-asset', manifest.release, entry.file, '--yes'], {
        stdio: 'inherit'
      })
    } catch {
      console.warn(`  ⚠ could not delete the asset ${entry.file} — dropping the entry anyway`)
    }
  }
  manifest.books = manifest.books.filter(b => b.id !== entry.id)
  console.log('  ✓ removed from the library')
  return true
}

async function main() {
  const argv = process.argv.slice(2)
  const force = argv.includes('--force')
  const dryRun = argv.includes('--dry-run')
  const auto = argv.includes('--yes')

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
    return walk(path.join(root, dir)).map(file => ({ file, kind }))
  })

  const prompt = prompter(auto)
  const skipped = []
  let added = 0
  let removed = 0

  for (const { file, kind } of found) {
    const already = force ? null : published(manifest, assets, file)
    if (already) {
      skipped.push(`${path.relative(root, file)} → ${already.id}`)
      continue
    }
    const meta = await describe(prompt, file, kind)
    if (addBook(manifest, file, meta, { dryRun })) added++
  }

  const onDesk = new Set(found.map(({ file }) => sourceName(file)))
  const missing = manifest.books.filter(b => b.source && !b.detached && !onDesk.has(b.source))
  for (const entry of missing) {
    if (await settleMissing(prompt, manifest, entry, dryRun)) removed++
  }

  prompt.close()

  if (skipped.length) {
    console.log(`\nAlready in the library (${skipped.length}):`)
    skipped.forEach(line => console.log(`  · ${line}`))
  }

  if (!added && !removed && !missing.length) {
    console.log('\nNothing to do.')
    return
  }
  if (dryRun) {
    console.log(`\n(dry run) ${added} added, ${removed} removed — nothing was written.`)
    return
  }

  writeManifest(manifest)
  console.log(`\n${added} added, ${removed} removed. data/library.json updated — left to do:`)
  console.log('  git add data/library.json && git commit -m "Update the library" && git push')
}

main()
