// The מקורות sheet as a PDF file.
//
// The sheet is set a second time, off screen, at the width of an A4 page's text
// column; it is cut into pages between two lines — never through one — and each
// page is laid on the paper inside the sheet's frame, under a running head and
// over a folio.
//
// The pages are pictures of the sheet: the browser sets the text, the two faces
// and the gematria rules with the very stylesheet the screen uses, and the file
// comes down in one click, with no print dialog. The price is that its text
// cannot be selected.

const MM = 72 / 25.4 // PDF points in a millimetre
const PAPER = { width: 210 * MM, height: 297 * MM } // A4
const MARGIN = { top: 24 * MM, bottom: 26 * MM, side: 24 * MM }
const FRAME = 11 * MM // from the edge of the paper to the frame
const SCALE = 0.6 // PDF points per CSS pixel: the text's 22px is set at 13pt
const DENSITY = 2 // image pixels per CSS pixel — about 220 dpi on the paper
const QUALITY = 0.92
const SLACK = 4 // CSS px of air kept above a page's first line and below its last

// The text column and the height of a page, in the CSS pixels the copy is set in
const COLUMN = (PAPER.width - 2 * MARGIN.side) / SCALE
const PAGE_HEIGHT = (PAPER.height - MARGIN.top - MARGIN.bottom) / SCALE

// The page in CSS pixels, for the screen that shows the pages the PDF will have
// (the two-page view of pages/mekorot.js).
export const PAGE = {
  width: PAPER.width / SCALE,
  height: PAPER.height / SCALE,
  top: MARGIN.top / SCALE,
  bottom: MARGIN.bottom / SCALE,
  side: MARGIN.side / SCALE,
  frame: FRAME / SCALE,
  column: COLUMN
}

// The sheet set again at the width of the text column — where the page can lay
// it out, out of sight — and cut into pages. `look` is a class that sets the
// copy for a screen rather than for paper. `done` takes the copy away.
async function setAside(sheet, look = '') {
  await document.fonts.ready
  const host = document.createElement('div')
  host.className = `src-print ${look}`.trim()
  host.setAttribute('dir', 'rtl')
  host.style.cssText = `position: fixed; top: 0; left: -100000px; width: ${COLUMN}px; pointer-events: none;`
  const copy = sheet.cloneNode(true)
  copy.querySelectorAll('.src-screen-only').forEach((el) => el.remove())
  // The two-page view hides the sheet it is made from; its copy is shown.
  copy.style.removeProperty('display')
  host.appendChild(copy)
  document.body.appendChild(host)
  const height = copy.getBoundingClientRect().height
  return { host, copy, height, pages: paginate(units(copy), height), done: () => host.remove() }
}

// The pages of the two-page view: where each one starts and ends in the sheet,
// and the sheet's markup to show through them. They are cut as the PDF's are,
// under the view's own `look`.
export async function layoutPages(sheet, look = '') {
  const { copy, height, pages, done } = await setAside(sheet, look)
  const html = copy.outerHTML
  done()
  return { pages, height, html }
}

// Each page of the sheet as a picture: the copy is measured where the page can
// lay it out, out of sight, and drawn from the same markup under the same rules.
async function pictures(sheet, look = '') {
  const faces = await sheetFonts()
  await document.fonts.load('400 16px "David Libre"', 'אב 12')
  const { host, copy, height, pages, done } = await setAside(sheet, look)
  try {
    const markup = pictureMarkup(host, copy, faces)
    const paper = getComputedStyle(copy).backgroundColor
    // Safari draws the first picture before the fonts it carries are ready;
    // one drawn and thrown away readies them for the pages that count.
    await draw(markup, pages[0], height, paper)
    const images = []
    for (const page of pages) {
      const canvas = await draw(markup, page, height, paper)
      images.push({ data: canvas.toDataURL('image/jpeg', QUALITY), height: page.bottom - page.top })
    }
    return images
  } finally {
    done()
  }
}

// The file's properties, and the right-to-left order of a Hebrew book.
function finish(pdf, { nav, author, book, chapter }) {
  pdf.setProperties({
    title: pdfText([book, chapter].filter(Boolean).join(' · ')),
    author: pdfText(author),
    subject: pdfText(nav),
    creator: pdfText('ס.פ.ר')
  })
  pdf.setLanguage('he')
  // A Hebrew book: two pages side by side are read from the right.
  pdf.viewerPreferences({ Direction: 'R2L' })
}

// The sheet as printed: A4 portrait, a page to a sheet of paper, inside the
// frame, under a running head and over a folio.
export async function downloadSheetPdf(sheet, source) {
  const { author, book, nav } = source
  const [{ jsPDF }, images] = await Promise.all([import('jspdf'), pictures(sheet)])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
  const soft = token('--src-ink-soft')
  const head = line([author, book].filter(Boolean).join(' · '), { width: COLUMN, height: 24, size: 15, color: soft })
  images.forEach((image, n) => {
    if (n > 0) pdf.addPage('a4', 'portrait')
    pdf.setDrawColor(token('--src-line-strong'))
    pdf.setLineWidth(0.6)
    pdf.rect(FRAME, FRAME, PAPER.width - 2 * FRAME, PAPER.height - 2 * FRAME, 'S')
    pdf.addImage(image.data, 'JPEG', MARGIN.side, MARGIN.top, COLUMN * SCALE, image.height * SCALE)
    if (images.length === 1) return
    // The running head from the second page on, the folio on every page, each
    // centred in the band between the text and the frame.
    if (n > 0) centre(pdf, head, 'running-head', COLUMN, 24, (FRAME + MARGIN.top) / 2)
    const folio = line(String(n + 1), { width: 60, height: 24, size: 15, color: soft })
    centre(pdf, folio, `folio-${n}`, 60, 24, (2 * PAPER.height - MARGIN.bottom - FRAME) / 2)
  })
  finish(pdf, source)
  pdf.save(fileName(nav))
}

// The two-page view as a file: A4 landscape, each sheet of paper one spread —
// the view's own pages, cut and set as the screen shows them (`look`), the
// first on the right, a blank page closing an odd count. No frame, no running
// head, no folio: what the view shows, and nothing more.
export async function downloadSpreadPdf(sheet, source, look) {
  const [{ jsPDF }, images] = await Promise.all([import('jspdf'), pictures(sheet, look)])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true })
  // A leaf is half the landscape sheet, the page it was cut for scaled down to it.
  const half = PAPER.height / 2
  const k = half / PAGE.width
  for (let n = 0; n < images.length; n += 2) {
    if (n > 0) pdf.addPage('a4', 'landscape')
    ;[images[n], images[n + 1]].forEach((image, side) => {
      if (!image) return
      const x = side === 0 ? half : 0
      pdf.addImage(image.data, 'JPEG', x + PAGE.side * k, PAGE.top * k, PAGE.column * k, image.height * k)
    })
  }
  finish(pdf, source)
  pdf.save(fileName(`${source.nav} — עמודים`))
}

// --- where the pages break ---------------------------------------------------

// What a page cannot cut through, top to bottom: the title page whole; each
// line of a paragraph, of an item or of a note; a heading or a lead-in, held to
// what follows it; a quote, the verses, a table, whole while they fit on a
// page. `glue` forbids a break after the unit — a paragraph leaves no single
// line at the foot of a page, and none alone at the head of the next.
function units(copy) {
  const origin = copy.getBoundingClientRect().top
  const box = (el) => {
    const rect = el.getBoundingClientRect()
    return { top: rect.top - origin, bottom: rect.bottom - origin }
  }
  const out = []
  const header = copy.querySelector('.src-header')
  if (header) out.push({ ...box(header), glue: false })
  const text = copy.querySelector('.src-text')
  Array.from(text ? text.children : []).forEach((el) => {
    const is = (name) => el.classList.contains(name)
    if (is('src-head') || is('src-label')) {
      out.push({ ...box(el), glue: true })
    } else if (is('src-para') || is('src-item') || is('src-intro')) {
      const lines = linesOf(el, origin)
      lines.forEach((l, i) => {
        out.push({ ...l, glue: i < lines.length - 1 && (i === 0 || i === lines.length - 2) })
      })
    } else {
      const whole = box(el)
      if (whole.bottom - whole.top <= PAGE_HEIGHT) out.push({ ...whole, glue: false })
      else linesOf(el, origin).forEach((l) => out.push({ ...l, glue: false }))
    }
  })
  return out.sort((a, b) => a.top - b.top)
}

// The lines of a block, from the boxes its text is drawn in: two boxes that
// share most of their height are on one line. A counted word's box reaches
// down over its rules, so a line ends below its lowest lane.
function linesOf(el, origin) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const boxes = Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .sort((a, b) => a.top - b.top)
  const lines = []
  boxes.forEach((r) => {
    const line = lines.find(
      (l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) > 0.5 * Math.min(l.bottom - l.top, r.height)
    )
    if (line) {
      line.top = Math.min(line.top, r.top)
      line.bottom = Math.max(line.bottom, r.bottom)
    } else {
      lines.push({ top: r.top, bottom: r.bottom })
    }
  })
  return lines.map((l) => ({ top: l.top - origin, bottom: l.bottom - origin }))
}

// Fill each page with as many units as it holds, and break after the last one
// that may be broken after. A page starts at its first line — the air between
// two blocks stays with the page before — and ends just below its last.
function paginate(units, height) {
  if (units.length === 0) return [{ top: 0, bottom: height }]
  const todo = units.map((u) => ({ ...u }))
  const pages = []
  let i = 0
  while (i < todo.length) {
    const top = pages.length === 0 ? 0 : Math.max(pages[pages.length - 1].bottom, todo[i].top - SLACK)
    let fits = i - 1
    let end = i - 1
    for (let j = i; j < todo.length && todo[j].bottom + SLACK - top <= PAGE_HEIGHT; j++) {
      fits = j
      if (!todo[j].glue) end = j
    }
    // What is held together runs longer than a page: break where it must.
    if (end < i) end = fits
    // A single unit taller than a page — nothing the sheet sets is — is cut at
    // the foot of the page rather than lost.
    if (end < i) {
      pages.push({ top, bottom: top + PAGE_HEIGHT })
      todo[i].top = top + PAGE_HEIGHT
      continue
    }
    const next = todo[end + 1]
    pages.push({ top, bottom: Math.min(todo[end].bottom + SLACK, next ? next.top : height) })
    i = end + 1
  }
  return pages
}

// --- the pictures --------------------------------------------------------------

// The copy as XHTML, under the app's own rules for the sheet and the two faces
// it is set in. What the page's body gives the copy by inheritance — the
// direction, the sans of the legend, the ink — is written on the wrapper, which
// has no body to inherit from inside the picture.
function pictureMarkup(host, copy, faces) {
  const inherited = getComputedStyle(host)
  const wrapper = document.createElement('div')
  wrapper.className = host.className
  wrapper.setAttribute('dir', 'rtl')
  wrapper.setAttribute('lang', 'he')
  wrapper.setAttribute(
    'style',
    [
      `width: ${COLUMN}px`,
      `font-family: ${inherited.fontFamily}`,
      `font-size: ${inherited.fontSize}`,
      `line-height: ${inherited.lineHeight}`,
      `color: ${inherited.color}`,
      '-webkit-font-smoothing: antialiased'
    ].join('; ')
  )
  const style = document.createElement('style')
  style.textContent = `${faces}\n${sheetRules()}`
  wrapper.append(style, copy.cloneNode(true))
  return new XMLSerializer().serializeToString(wrapper)
}

// The rules the sheet is set by: the tokens of :root, the universal reset, and
// every rule that names a .src- class.
function sheetRules() {
  const out = []
  Array.from(document.styleSheets).forEach((sheet) => {
    let rules = null
    try {
      rules = sheet.cssRules
    } catch (error) {
      return // another origin's stylesheet: the fonts are read on their own
    }
    Array.from(rules || []).forEach((rule) => {
      if (rule instanceof CSSFontFaceRule || rule instanceof CSSImportRule) return
      const selector = rule.selectorText || ''
      if (selector === ':root' || selector === '*' || rule.cssText.includes('.src-')) out.push(rule.cssText)
    })
  })
  return out.join('\n')
}

// One page: the markup seen through a window the page's height, drawn at the
// density of the paper.
async function draw(markup, page, fullHeight, paper) {
  const width = COLUMN
  const height = page.bottom - page.top
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 ${page.top} ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${fullHeight}">${markup}</foreignObject></svg>`
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * DENSITY)
  canvas.height = Math.round(height * DENSITY)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      image
        .decode()
        .catch(() => {})
        .then(() => requestAnimationFrame(() => resolve(image)))
    }
    image.onerror = () => reject(new Error('The sheet could not be drawn'))
    image.decoding = 'async'
    image.src = src
  })
}

// --- the page around the text ------------------------------------------------

// One line of David Libre, drawn as a picture: the PDF carries no Hebrew font of
// its own.
function line(text, { width, height, size, color }) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * DENSITY)
  canvas.height = Math.ceil(height * DENSITY)
  const ctx = canvas.getContext('2d')
  ctx.scale(DENSITY, DENSITY)
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.font = `400 ${size}px "David Libre", serif`
  ctx.fillText(text, width / 2, height / 2)
  return canvas.toDataURL('image/png')
}

// A picture `width` × `height` CSS px, centred on the page's width and on the
// height `y` (in points).
function centre(pdf, data, alias, width, height, y) {
  const w = width * SCALE
  const h = height * SCALE
  pdf.addImage(data, 'PNG', (PAPER.width - w) / 2, y - h / 2, w, h, alias)
}

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// jsPDF writes the document's properties byte for byte, so a Hebrew title must
// reach it already encoded as a PDF text string: UTF-16BE, after its BOM.
function pdfText(text) {
  if (!text) return ''
  let out = 'þÿ'
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    out += String.fromCharCode(code >> 8, code & 0xff)
  }
  return out
}

const fileName = (title) => `${(title || 'מקור').replace(/[\\/:*?"<>|]+/g, '-').trim()}.pdf`

// --- the faces ---------------------------------------------------------------

// A picture keeps only the fonts it carries, so the two faces the sheet is set
// in travel inside it: their Hebrew and Latin ranges, read once from whatever
// stylesheet the app loads them with — the Google Fonts link of
// pages/_document.js in development, the CSS Next inlines in its place in a
// build — and inlined as data.
const FACES = /font-family:\s*["']?(David Libre|Frank Ruhl Libre)["']?/i
let facesCSS = null

function sheetFonts() {
  if (!facesCSS) {
    facesCSS = inlineFaces().catch((error) => {
      console.warn('The PDF is set without its web fonts:', error)
      facesCSS = null
      return ''
    })
  }
  return facesCSS
}

async function inlineFaces() {
  const faces = (await fontFaces()).filter(
    (face) => FACES.test(face.css) && (covers(face.css, 0x05d0) || covers(face.css, 0x30))
  )
  const files = new Map()
  const inlined = await Promise.all(
    faces.map(async (face) => {
      const src = (face.css.match(/url\(\s*["']?([^"')]+)["']?\s*\)/) || [])[1]
      if (!src || src.startsWith('data:')) return face.css
      const url = new URL(src, face.base).href
      if (!files.has(url)) files.set(url, fetch(url).then((res) => res.blob()).then(dataURL))
      return face.css.replace(src, await files.get(url))
    })
  )
  return inlined.join('\n')
}

// Every @font-face of the document, with the address its sources are relative to.
async function fontFaces() {
  const faces = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules = null
    try {
      rules = sheet.cssRules
    } catch (error) {
      rules = null // a stylesheet from another origin keeps its rules to itself
    }
    const base = sheet.href || window.location.href
    if (rules) {
      Array.from(rules).forEach((rule) => {
        if (rule instanceof CSSFontFaceRule) faces.push({ css: rule.cssText, base })
      })
    } else if (sheet.href) {
      const css = await (await fetch(sheet.href)).text()
      ;(css.match(/@font-face\s*{[^}]*}/g) || []).forEach((face) => faces.push({ css: face, base }))
    }
  }
  return faces
}

// Does the face's unicode-range hold this code point? A face without one holds all.
function covers(css, code) {
  const range = css.match(/unicode-range:\s*([^;}]+)/i)
  if (!range) return true
  return range[1].split(',').some((part) => {
    const [from, to = from] = part.trim().replace(/^U\+/i, '').split('-')
    return parseInt(from, 16) <= code && code <= parseInt(to, 16)
  })
}

const dataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
