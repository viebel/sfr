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

function copyIfStale(source, target) {
  const stale =
    !fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(source).mtimeMs
  if (stale) {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(source, target)
    return 1
  }
  return 0
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
