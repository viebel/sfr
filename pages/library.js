import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppNav from '../components/AppNav'
import { bookHref } from '../data/books'
import { sources } from '../data/sources'
import { pickView, readHistory, readingStateOf, recordRead } from '../utils/readingHistory'
import { loadSession, saveSession } from '../utils/readerSession'

// pdf.js is loaded lazily, in the browser, and outside the bundler: webpackIgnore
// keeps this a native dynamic import of the copy scripts/copy-pdf-worker.js puts
// in public/. Letting Next bundle pdfjs-dist breaks this page's client bundle.
let pdfjsPromise = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* webpackIgnore: true */ '/pdfjs/pdf.min.mjs').then(mod => {
      mod.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'
      return mod
    })
  }
  return pdfjsPromise
}

// pdf.js fetches these by URL at runtime; without them PDFs using CID fonts,
// non-embedded standard fonts or JPEG2000 images render wrong.
//
/*
 * disableFontFace: pdf.js paints the letters itself, from the outlines in the
 * file, instead of handing the browser a font it rebuilt from the embedded
 * subset and letting the browser's font engine draw it.
 *
 * Handing it over renders a little better — the engine hints the stems, and the
 * same page carries about a fifth more ink than the outlines do, which at the
 * size a page fitted to the window gives 9pt type is the difference between
 * crisp and grey. That is why it had been left on.
 *
 * But it makes the page depend on what the browser makes of that rebuilt font,
 * and some of them lose glyphs in it. A PDF written by LibreOffice — symbolic
 * TrueType subsets, no /Encoding, one glyph placed at a time — came back with
 * every ו and every י missing: their width still reserved, so the words fell
 * apart into scattered letters, while the same file was fine in ghostscript and
 * fine here. Outlines cannot lose a letter that way; nothing between pdf.js and
 * the canvas can drop it. A thinner stem is worth that.
 */
const pdfjsOptions = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
  disableFontFace: true
}

/*
 * Reading a book the way a desktop reader does: ask for the bytes of the page
 * on screen and leave the rest of the file where it is.
 *
 *   disableStream     drop the whole-file request as soon as its headers say
 *                     the server takes ranges, instead of draining it;
 *   disableAutoFetch  and don't quietly pull the rest in the background either;
 *   rangeChunkSize    ask in 256 KB pieces rather than 64 KB — every request is
 *                     a round trip through pages/api/book to the release, and a
 *                     scanned page is about that big.
 *
 * These only bite because the reader no longer walks to the last page before
 * it opens a book — see the patch in scripts/copy-pdf-worker.js, without which
 * a flat page tree makes pdf.js read the whole file whatever it is asked.
 */
const readAsNeeded = {
  disableStream: true,
  disableAutoFetch: true,
  rangeChunkSize: 256 * 1024
}

function bookSource(book) {
  return { url: bookHref(book), ...readAsNeeded }
}

const zoomSteps = [0.5, 0.67, 0.8, 0.9, 1, 1.15, 1.35, 1.6, 2, 2.5, 3, 4]

function Icon({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

// Not a folder — a folder says "somewhere", and users read it as a place in the
// app. An arrow rising out of a tray says "a file of mine, from this machine".
const IconOpen = () => (
  <Icon>
    <path d="M12 15V3.8" />
    <path d="M7.8 8 12 3.8 16.2 8" />
    <path d="M4.5 14.5v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />
  </Icon>
)
const IconLibrary = () => (
  <Icon>
    <path d="M4 4.5h3.5v15H4zM8.5 4.5H12v15H8.5z" />
    <path d="m14.2 5.6 3.4-.9 3 11.6-3.4.9z" />
    <path d="M4 19.5h16" />
  </Icon>
)
// The two shelves of the library. Both are read at 20px in a panel header, so
// they are drawn as silhouettes — stacked volumes, and a written scroll between
// its rollers — rather than as outlines that collapse into a grey smudge.
const IconBook = ({ size = 20 }) => (
  <Icon size={size}>
    <rect x="3.5" y="5.5" width="17" height="5" rx="1.4" />
    <rect x="3.5" y="13.5" width="17" height="5" rx="1.4" />
    <path d="M7.5 5.5v5M7.5 13.5v5" />
  </Icon>
)
const IconScroll = ({ size = 20 }) => (
  <Icon size={size}>
    <rect x="3.6" y="4.5" width="3" height="15" rx="1.5" />
    <rect x="17.4" y="4.5" width="3" height="15" rx="1.5" />
    <path d="M8.6 8.5h6.8M8.6 12h6.8M8.6 15.5h6.8" />
  </Icon>
)
/* מקורות are springs: water rising from a mouth in the ground, in the same
   line weight as the shelves beside it. */
const IconSpring = ({ size = 20 }) => (
  <Icon size={size}>
    <path d="M3.5 17.5h17" />
    <path d="M7.5 17.5c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
    <path d="M12 9.5V4.2M8.6 10.6 6.4 6.6M15.4 10.6l2.2-4" />
  </Icon>
)
const IconClock = ({ size = 20 }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 6.8V12l3.4 2.2" />
  </Icon>
)
const IconClose = ({ size = 18 }) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
// Chevrons name a side of the screen, not a side of the book: which one means
// "further into the book" depends on the direction the book is read in.
const IconChevronRight = () => (
  <Icon>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)
const IconChevronLeft = () => (
  <Icon>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)
const IconEndRight = () => (
  <Icon>
    <path d="M6 5l7 7-7 7" />
    <path d="M13 5l5 7-5 7" />
  </Icon>
)
const IconEndLeft = () => (
  <Icon>
    <path d="M18 5l-7 7 7 7" />
    <path d="M11 5l-5 7 5 7" />
  </Icon>
)
const IconZoomIn = () => (
  <Icon>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M11 8.5v5M8.5 11h5M16 16l4.5 4.5" />
  </Icon>
)
const IconZoomOut = () => (
  <Icon>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M8.5 11h5M16 16l4.5 4.5" />
  </Icon>
)
const IconFitPage = () => (
  <Icon>
    <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
    <path d="M12 7v10M12 7l-2 2M12 7l2 2M12 17l-2-2M12 17l2-2" />
  </Icon>
)
const IconFitWidth = () => (
  <Icon>
    <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
    <path d="M7.5 12h9M7.5 12l2-2M7.5 12l2 2M16.5 12l-2-2M16.5 12l-2 2" />
  </Icon>
)
const IconSpread = () => (
  <Icon>
    <path d="M12 6.2C10.5 5.1 8.6 4.5 6.4 4.5H3.5v13h2.9c2.2 0 4.1.6 5.6 1.7 1.5-1.1 3.4-1.7 5.6-1.7h2.9v-13h-2.9c-2.2 0-4.1.6-5.6 1.7z" />
    <path d="M12 6.2v13" />
  </Icon>
)
const IconSingle = () => (
  <Icon>
    <rect x="6.5" y="3.5" width="11" height="17" rx="1.5" />
  </Icon>
)
const IconShift = () => (
  <Icon>
    <path d="M4 9h13l-3-3M20 15H7l3 3" />
  </Icon>
)
const IconRotate = () => (
  <Icon>
    <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
    <path d="M20.5 3.5v5h-5" />
  </Icon>
)
const IconExpand = () => (
  <Icon>
    <path d="M9 3.5H5.5a2 2 0 0 0-2 2V9M15 3.5h3.5a2 2 0 0 1 2 2V9M9 20.5H5.5a2 2 0 0 1-2-2V15M15 20.5h3.5a2 2 0 0 0 2-2V15" />
  </Icon>
)
// Lines of text with the arrow of the direction they are read in.
const IconDirection = ({ rtl }) => (
  <Icon>
    <path d="M4.5 6h15M4.5 10.5h15M4.5 15h9" />
    {rtl ? <path d="M9 19.5 5.5 17 9 14.5" /> : <path d="m15 19.5 3.5-2.5-3.5-2.5" />}
  </Icon>
)

// A spread groups pages so that the lower page number sits on the reading side.
function groupStart(page, spread, coverAlone) {
  if (!spread) return page
  if (coverAlone) return page <= 1 ? 1 : page % 2 === 0 ? page : page - 1
  return page % 2 === 1 ? page : page - 1
}

function groupPages(page, spread, coverAlone, numPages) {
  const start = groupStart(page, spread, coverAlone)
  if (!spread) return [start]
  if (coverAlone && start === 1) return [1]
  return [start, start + 1].filter(n => n >= 1 && n <= numPages)
}

// A Hebrew or Arabic title means a book bound on the right; anything else opens
// the way a Latin book does. An explicit `dir` on the entry always wins.
function guessDir(title, declared) {
  if (declared === 'rtl' || declared === 'ltr') return declared
  return /[֐-׿؀-ۿ]/.test(String(title || '')) ? 'rtl' : 'ltr'
}

/*
 * How many device pixels to rasterise per CSS pixel. Matching the display's own
 * ratio is the usual advice, and it is what makes small type look soft: on a
 * 1x screen a page fitted to the window puts 9pt text on ~12 pixels, and the
 * stems fall between them. Rendering above the display and letting the browser
 * downscale spends memory to buy those in-between samples back.
 */
const maxRenderPixels = 16e6 // ~64 MB of canvas, per page
function renderScale(viewport) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const wanted = Math.min(Math.max(dpr * 1.5, 2), 4)
  const area = viewport.width * viewport.height * wanted * wanted
  return area > maxRenderPixels
    ? Math.max(1, wanted * Math.sqrt(maxRenderPixels / area))
    : wanted
}

/*
 * Which way a book opens, when three answers are on the table: the one declared
 * in data/library.json, the one this reader last read it with, and the guess
 * from its title.
 *
 * The stored answer normally wins — flipping the direction on a book is meant
 * to stick. But a declared direction that has changed since wins over it:
 * editing library.json is how a book's binding gets corrected, and the
 * correction has to reach a reader who already opened it once. Which of the two
 * happened is told by dirFrom, the declaration the stored answer settled
 * against.
 */
function resolveDir(title, declared, view) {
  if (declared && view?.dirFrom !== declared) return { dir: declared, dirFrom: declared }
  if (view?.dir) return { dir: view.dir, dirFrom: view.dirFrom ?? declared ?? null }
  return { dir: guessDir(title, declared), dirFrom: declared ?? null }
}

function PdfPageView({ pdfDoc, pageNumber, boxWidth, boxHeight, fitMode, zoom, rotation }) {
  const canvasRef = useRef(null)
  const textRef = useRef(null)
  const chainRef = useRef(Promise.resolve())
  const taskRef = useRef(null)
  const textLayerRef = useRef(null)
  const [size, setSize] = useState(null)

  useEffect(() => {
    let cancelled = false
    const previous = chainRef.current

    chainRef.current = (async () => {
      // Renders of the same canvas must never overlap: wait for the previous one.
      await previous.catch(() => {})
      if (cancelled) return

      let page
      try {
        page = await pdfDoc.getPage(pageNumber)
      } catch {
        return
      }
      if (cancelled) return

      const base = page.getViewport({ scale: 1, rotation })
      const fitWidth = boxWidth / base.width
      const fitHeight = boxHeight / base.height
      const fit = fitMode === 'page' ? Math.min(fitWidth, fitHeight) : fitWidth
      const scale = Math.max(0.05, fit * zoom)
      const viewport = page.getViewport({ scale, rotation })

      const canvas = canvasRef.current
      const textDiv = textRef.current
      if (!canvas || !textDiv) return

      const outputScale = renderScale(viewport)
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      setSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height), scale })

      const context = canvas.getContext('2d', { alpha: false })
      // Scans are images being shrunk to the page box; the default 'low'
      // filter makes a bitonal scan crawl with aliasing.
      context.imageSmoothingQuality = 'high'
      context.save()
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.restore()

      const task = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
      })
      taskRef.current = task
      try {
        await task.promise
      } catch {
        return
      } finally {
        if (taskRef.current === task) taskRef.current = null
      }
      if (cancelled) return

      // Selectable text on top of the rendered bitmap.
      textLayerRef.current?.cancel()
      textDiv.replaceChildren()
      try {
        const pdfjs = await loadPdfjs()
        if (cancelled) return
        const textLayer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textDiv,
          viewport
        })
        textLayerRef.current = textLayer
        await textLayer.render()
      } catch {
        /* text layer is a bonus — a failure must not break the page */
      }
    })()

    return () => {
      cancelled = true
      try {
        taskRef.current?.cancel()
      } catch {
        /* already settled */
      }
      textLayerRef.current?.cancel()
      textLayerRef.current = null
    }
  }, [pdfDoc, pageNumber, boxWidth, boxHeight, fitMode, zoom, rotation])

  return (
    <div
      className="pdfr-sheet"
      style={{
        width: size ? `${size.width}px` : undefined,
        height: size ? `${size.height}px` : undefined,
        '--scale-factor': size ? size.scale : 1
      }}
    >
      <canvas ref={canvasRef} className="pdfr-canvas" />
      <div ref={textRef} className="textLayer" />
      <div className="pdfr-sheet-number">{pageNumber}</div>
    </div>
  )
}

// Everything a tab holds. Each open document keeps its own place, zoom and
// binding, so switching between two books never disturbs either of them.
// What a book is read with, until it is read with something else.
const defaultView = () => ({
  spread: true,
  coverAlone: true,
  fitMode: 'page',
  zoomIndex: zoomSteps.indexOf(1),
  rotation: 0
})

function newDoc({ key, title, bookId, source, dir, dirFrom, page, view, status = 'loading' }) {
  const settings = { ...defaultView(), ...(view || {}) }
  return {
    key,
    title,
    bookId: bookId || '',
    source,
    status, // idle | loading | ready | error
    error: '',
    progress: 0,
    pdfDoc: null,
    numPages: 0,
    page: page || 1,
    pageDraft: String(page || 1),
    ...settings,
    dir: dir || settings.dir || 'rtl',
    dirFrom: dirFrom !== undefined ? dirFrom : settings.dirFrom || null
  }
}

export default function Library({ books = [] }) {
  const [docs, setDocs] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [hydrated, setHydrated] = useState(false)
  const [notice, setNotice] = useState('')

  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const fileInputRef = useRef(null)
  const docsRef = useRef(docs)
  const keySeqRef = useRef(0)
  const tasksRef = useRef(new Map())
  const closedRef = useRef(new Set())
  const bootedRef = useRef(false)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    docsRef.current = docs
  }, [docs])

  const doc = docs.find(d => d.key === activeKey) || null
  const pdfDoc = doc?.pdfDoc || null
  const numPages = doc?.numPages || 0
  const dir = doc?.dir || 'rtl'
  const rtl = dir === 'rtl'
  const zoom = zoomSteps[doc?.zoomIndex ?? zoomSteps.indexOf(1)]
  const pages = pdfDoc ? groupPages(doc.page, doc.spread, doc.coverAlone, numPages) : []

  const patchDoc = useCallback((key, patch) => {
    setDocs(ds => ds.map(d => (d.key === key ? { ...d, ...patch } : d)))
  }, [])

  const patchActive = useCallback(
    patch => {
      const key = docsRef.current.find(d => d.key === activeKey)?.key
      if (key) patchDoc(key, patch)
    },
    [activeKey, patchDoc]
  )

  // --- document loading -----------------------------------------------------

  const loadInto = useCallback(
    async (key, source, fallbackPage) => {
      if (!source) return
      patchDoc(key, { status: 'loading', error: '', progress: 0 })
      try {
        const pdfjs = await loadPdfjs()
        const task = pdfjs.getDocument({ ...pdfjsOptions, ...source })
        tasksRef.current.set(key, task)
        // 40 MB of manuscript takes a while to arrive: report how far it got.
        task.onProgress = ({ loaded, total }) => {
          if (closedRef.current.has(key)) return
          patchDoc(key, { progress: total ? Math.min(loaded / total, 1) : 0 })
        }
        const pdf = await task.promise
        if (closedRef.current.has(key)) {
          task.destroy()
          return
        }
        const wanted = docsRef.current.find(d => d.key === key)?.page || fallbackPage || 1
        const landing = Math.min(Math.max(wanted, 1), pdf.numPages)
        patchDoc(key, {
          pdfDoc: pdf,
          numPages: pdf.numPages,
          status: 'ready',
          page: landing,
          pageDraft: String(landing)
        })
      } catch (e) {
        if (closedRef.current.has(key)) return
        patchDoc(key, { status: 'error', error: e?.message || 'לא ניתן לפתוח את הקובץ' })
      }
    },
    [patchDoc]
  )

  const activate = useCallback(
    key => {
      setActiveKey(key)
      // A tab restored from the last session holds its place and its settings
      // but no document: it is fetched the moment it is brought forward.
      const target = docsRef.current.find(d => d.key === key)
      if (target?.status === 'idle') loadInto(key, target.source, target.page)
    },
    [loadInto]
  )

  const openDoc = useCallback(
    ({ source, title, bookId = '', dir: declared, page }) => {
      // A book already open is brought forward rather than loaded a second time.
      if (bookId) {
        const open = docsRef.current.find(d => d.bookId === bookId)
        if (open) {
          if (page) patchDoc(open.key, { page, pageDraft: String(page) })
          setLibraryOpen(false)
          activate(open.key)
          return
        }
      }

      // Where to land, and how to read: an explicit page wins, then whatever
      // this book was last left at, with the settings it was left in.
      const saved = bookId ? readingStateOf(bookId) : { page: 0, view: null }
      const start = page || saved.page || 1
      const key = `doc${++keySeqRef.current}`
      setDocs(ds => [
        ...ds,
        newDoc({
          key,
          title,
          bookId,
          source,
          page: start,
          view: saved.view,
          ...resolveDir(title, declared, saved.view)
        })
      ])
      setActiveKey(key)
      setLibraryOpen(false)
      loadInto(key, source, start)
    },
    [activate, loadInto, patchDoc]
  )

  const openFile = useCallback(
    async file => {
      if (!file) return
      if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
        return
      }
      const data = new Uint8Array(await file.arrayBuffer())
      openDoc({ source: { data }, title: file.name })
    },
    [openDoc]
  )

  const openBook = useCallback(
    (book, page) => {
      openDoc({
        source: bookSource(book),
        title: book.title,
        bookId: book.id,
        dir: book.dir,
        page
      })
    },
    [openDoc]
  )

  const closeDoc = useCallback(key => {
    closedRef.current.add(key)
    const task = tasksRef.current.get(key)
    tasksRef.current.delete(key)
    const current = docsRef.current
    const index = current.findIndex(d => d.key === key)
    const rest = current.filter(d => d.key !== key)
    setDocs(rest)
    setActiveKey(active =>
      active === key ? rest[Math.min(index, rest.length - 1)]?.key ?? null : active
    )
    try {
      current[index]?.pdfDoc?.loadingTask?.destroy()
      task?.destroy()
    } catch {
      /* already gone */
    }
  }, [])

  /*
   * Opening the page: the books that were open come back as tabs, each with the
   * page and the settings it was last read with. A ?book= or ?url= link takes
   * the front; otherwise the tab that was in front stays in front. Only that
   * one is fetched — the others wait to be clicked.
   */
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    setHistory(readHistory())

    const params = new URLSearchParams(window.location.search)
    const wantedPage = parseInt(params.get('page'), 10)
    const page = Number.isFinite(wantedPage) && wantedPage > 0 ? wantedPage : 0
    const linkedId = (params.get('book') || '').normalize('NFC')
    const url = params.get('url')

    const fromBook = book => {
      const saved = readingStateOf(book.id)
      return newDoc({
        key: `doc${++keySeqRef.current}`,
        title: book.title,
        bookId: book.id,
        source: bookSource(book),
        page: saved.page || 1,
        view: saved.view,
        ...resolveDir(book.title, book.dir, saved.view),
        status: 'idle'
      })
    }

    const session = loadSession()
    const restored = session.docs
      .map(entry => books.find(b => b.id === entry.bookId))
      .filter(Boolean)
      .map(fromBook)

    let front = null
    const linked = linkedId ? books.find(b => b.id === linkedId) : null
    if (linked) {
      front = restored.find(d => d.bookId === linked.id)
      if (!front) {
        front = fromBook(linked)
        restored.push(front)
      }
      if (page) {
        front.page = page
        front.pageDraft = String(page)
      }
    } else if (url) {
      const name = decodeURIComponent(url.split('/').pop() || 'PDF')
      front = newDoc({
        key: `doc${++keySeqRef.current}`,
        title: name,
        // A PDF from anywhere else is read the same way; a server that will not
        // do ranges just gets the whole file, which is pdf.js's own fallback.
        source: { url, ...readAsNeeded },
        page: page || 1,
        dir: guessDir(name),
        status: 'idle'
      })
      restored.push(front)
    } else if (linkedId) {
      setNotice('הספר לא נמצא בספרייה')
    } else if (session.active) {
      front = restored.find(d => d.bookId === session.active)
    }
    if (!front) front = restored[0] || null

    if (restored.length) setDocs(restored)
    if (front) {
      setActiveKey(front.key)
      loadInto(front.key, front.source, front.page)
    }
    setHydrated(true)
  }, [books, loadInto])

  // Keep the address bar on the book being read, so a reload — or a link handed
  // to someone else — comes back to this page of this book.
  useEffect(() => {
    if (!doc || doc.status !== 'ready') return
    const params = new URLSearchParams(window.location.search)
    if (doc.bookId) params.set('book', doc.bookId)
    else params.delete('book')
    params.set('page', String(doc.page))
    const next = `${window.location.pathname}?${params}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next)
    }
  }, [doc])

  // The reading memory: the page reached and the settings it was read with,
  // written as you turn pages and as you change how the book is displayed.
  useEffect(() => {
    if (!doc || doc.status !== 'ready' || !doc.bookId) return
    const timer = setTimeout(() => {
      recordRead({
        id: doc.bookId,
        title: doc.title,
        page: doc.page,
        numPages: doc.numPages,
        view: pickView(doc)
      })
      setHistory(readHistory())
    }, 600)
    return () => clearTimeout(timer)
  }, [doc])

  // Which books are open, and which one is in front. Held back until the
  // restore above has run, so an empty first render cannot erase the session.
  useEffect(() => {
    if (!hydrated) return
    saveSession({
      docs: docs.filter(d => d.bookId).map(d => ({ bookId: d.bookId, title: d.title })),
      active: doc?.bookId || ''
    })
  }, [hydrated, docs, doc])

  useEffect(
    () => () => {
      docsRef.current.forEach(d => {
        try {
          d.pdfDoc?.loadingTask?.destroy()
        } catch {
          /* leaving the page anyway */
        }
      })
    },
    []
  )

  // --- navigation -----------------------------------------------------------

  const goTo = useCallback(
    n => {
      if (!numPages) return
      const clamped = Math.min(Math.max(n, 1), numPages)
      patchActive({ page: clamped, pageDraft: String(clamped) })
    },
    [numPages, patchActive]
  )

  const goForward = useCallback(() => {
    if (!doc) return
    const shown = groupPages(doc.page, doc.spread, doc.coverAlone, numPages)
    const next = shown[shown.length - 1] + 1
    if (next <= numPages) goTo(groupStart(next, doc.spread, doc.coverAlone))
  }, [doc, numPages, goTo])

  const goBack = useCallback(() => {
    if (!doc) return
    const start = groupStart(doc.page, doc.spread, doc.coverAlone)
    if (start > 1) goTo(groupStart(start - 1, doc.spread, doc.coverAlone))
  }, [doc, goTo])

  const atStart = pages.length > 0 && groupStart(doc.page, doc.spread, doc.coverAlone) <= 1
  const atEnd = pages.length > 0 && pages[pages.length - 1] >= numPages

  const zoomBy = useCallback(
    delta => {
      if (!doc) return
      patchActive({
        zoomIndex: Math.min(Math.max(doc.zoomIndex + delta, 0), zoomSteps.length - 1)
      })
    },
    [doc, patchActive]
  )

  // --- keyboard -------------------------------------------------------------

  useEffect(() => {
    const onKey = e => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        // The arrow that walks into the book is the one pointing at the spine.
        case 'ArrowLeft':
          e.preventDefault()
          rtl ? goForward() : goBack()
          break
        case 'ArrowRight':
          e.preventDefault()
          rtl ? goBack() : goForward()
          break
        case 'PageDown':
        case ' ':
          e.preventDefault()
          goForward()
          break
        case 'PageUp':
          e.preventDefault()
          goBack()
          break
        case 'Home':
          e.preventDefault()
          goTo(1)
          break
        case 'End':
          e.preventDefault()
          goTo(numPages)
          break
        case '+':
        case '=':
          e.preventDefault()
          zoomBy(1)
          break
        case '-':
          e.preventDefault()
          zoomBy(-1)
          break
        case '0':
          e.preventDefault()
          patchActive({ zoomIndex: zoomSteps.indexOf(1) })
          break
        default:
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goForward, goBack, goTo, zoomBy, numPages, rtl, patchActive])

  // --- available room for the pages ----------------------------------------

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    let frame = null
    const measure = () => {
      frame = null
      const rect = el.getBoundingClientRect()
      setBox({ width: rect.width, height: rect.height })
    }
    const observer = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(el)
    measure()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // The two pages of a spread sit flush against each other, as in a bound book,
  // so there is no gap to subtract — only the stage padding (see .pdfr-stage).
  const stagePad = 24
  const count = Math.max(pages.length, 1)
  const boxWidth = Math.max(80, (box.width - stagePad * 2) / count)
  const boxHeight = Math.max(80, box.height - stagePad * 2)

  // --- drag & drop ----------------------------------------------------------

  const onDrop = e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) openFile(file)
  }

  const toggleFullscreen = () => {
    const el = rootRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }

  // Printed books, manuscripts and the מקורות set as pages are shelves of the
  // same library, and what you were reading is one more — the one you reach for
  // most.
  const shelves = useMemo(() => {
    const recent = history
      .map(entry => {
        const book = books.find(b => b.id === entry.id)
        return book ? { ...book, resumePage: entry.page } : null
      })
      .filter(Boolean)
      .slice(0, 4)

    return [
      { kind: 'recent', label: 'אחרונים', icon: <IconClock />, items: recent },
      {
        kind: 'book',
        label: 'ספרים',
        icon: <IconBook />,
        items: books.filter(b => (b.kind || 'book') === 'book')
      },
      {
        kind: 'manuscript',
        label: 'כתבי יד',
        icon: <IconScroll />,
        items: books.filter(b => b.kind === 'manuscript')
      },
      {
        kind: 'source',
        label: 'מקורות',
        icon: <IconSpring />,
        // A source is not a PDF the reader opens but a page of its own; the
        // shelf carries where it is read rather than a book to load.
        items: sources.map(source => ({
          id: source.id,
          title: source.nav,
          author: source.author,
          year: source.work,
          href: `/mekorot?src=${encodeURIComponent(source.id)}`
        }))
      }
    ].filter(shelf => shelf.items.length > 0)
  }, [books, history])

  const submitPage = e => {
    e.preventDefault()
    const n = parseInt(doc?.pageDraft, 10)
    if (Number.isFinite(n)) goTo(n)
    else patchActive({ pageDraft: String(doc?.page ?? 1) })
  }

  const loadingPct = doc && doc.status === 'loading' ? Math.round(doc.progress * 100) : 0

  return (
    <>
      <Head>
        <title>ס.פ.ר — ספרייה</title>
        <meta name="description" content="ספרייה וקורא PDF, מימין לשמאל ומשמאל לימין" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div
        ref={rootRef}
        className={`pdfr-root${dragging ? ' dragging' : ''}`}
        onDragOver={e => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={e => {
          if (e.currentTarget === e.target) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <AppNav current="library" />

        <div className="pdfr-toolbar">
          <div className="pdfr-toolbar-group">
            <button
              type="button"
              className={`pdfr-btn${libraryOpen ? ' on' : ''}`}
              onClick={() => setLibraryOpen(o => !o)}
              title="ספרייה"
              aria-label="ספרייה"
              aria-expanded={libraryOpen}
            >
              <IconLibrary />
            </button>
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => fileInputRef.current?.click()}
              title="פתיחת קובץ PDF"
              aria-label="פתיחת קובץ PDF"
            >
              <IconOpen />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="pdfr-file-input"
              onChange={e => {
                openFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => patchActive({ dir: rtl ? 'ltr' : 'rtl' })}
              disabled={!doc}
              title={rtl ? 'קריאה משמאל לימין' : 'קריאה מימין לשמאל'}
              aria-label={rtl ? 'קריאה משמאל לימין' : 'קריאה מימין לשמאל'}
            >
              <IconDirection rtl={rtl} />
            </button>
          </div>

          {/* The chevrons keep the book's own direction, so "further in" is
              always the button on the side the reader is heading towards. */}
          <div className="pdfr-toolbar-group" style={{ direction: dir }}>
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => goTo(1)}
              disabled={!pdfDoc || atStart}
              title="לעמוד הראשון"
              aria-label="לעמוד הראשון"
            >
              {rtl ? <IconEndRight /> : <IconEndLeft />}
            </button>
            <button
              type="button"
              className="pdfr-btn"
              onClick={goBack}
              disabled={!pdfDoc || atStart}
              title="אחורה"
              aria-label="אחורה"
            >
              {rtl ? <IconChevronRight /> : <IconChevronLeft />}
            </button>
            <form className="pdfr-pagebox" onSubmit={submitPage}>
              <input
                type="text"
                inputMode="numeric"
                className="pdfr-page-input"
                value={doc?.pageDraft ?? ''}
                disabled={!pdfDoc}
                onChange={e => patchActive({ pageDraft: e.target.value.replace(/[^0-9]/g, '') })}
                onBlur={submitPage}
                aria-label="מספר עמוד"
              />
              <span className="pdfr-page-total">/ {numPages || '—'}</span>
            </form>
            <button
              type="button"
              className="pdfr-btn"
              onClick={goForward}
              disabled={!pdfDoc || atEnd}
              title="קדימה"
              aria-label="קדימה"
            >
              {rtl ? <IconChevronLeft /> : <IconChevronRight />}
            </button>
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => goTo(numPages)}
              disabled={!pdfDoc || atEnd}
              title="לעמוד האחרון"
              aria-label="לעמוד האחרון"
            >
              {rtl ? <IconEndLeft /> : <IconEndRight />}
            </button>
          </div>

          <div className="pdfr-toolbar-group">
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => zoomBy(-1)}
              disabled={!doc || doc.zoomIndex === 0}
              title="הקטנה"
              aria-label="הקטנה"
            >
              <IconZoomOut />
            </button>
            <span className="pdfr-zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => zoomBy(1)}
              disabled={!doc || doc.zoomIndex === zoomSteps.length - 1}
              title="הגדלה"
              aria-label="הגדלה"
            >
              <IconZoomIn />
            </button>
            <button
              type="button"
              className={`pdfr-btn${doc?.fitMode === 'width' ? ' on' : ''}`}
              onClick={() => {
                // Fitting the page and then keeping a 200% multiplier on top of
                // it fits nothing: asking for the whole page puts the zoom back
                // to where the fit is what you see.
                const fitMode = doc?.fitMode === 'page' ? 'width' : 'page'
                patchActive(
                  fitMode === 'page' ? { fitMode, zoomIndex: zoomSteps.indexOf(1) } : { fitMode }
                )
              }}
              disabled={!doc}
              title={doc?.fitMode === 'page' ? 'התאמה לרוחב' : 'התאמה לעמוד'}
              aria-label={doc?.fitMode === 'page' ? 'התאמה לרוחב' : 'התאמה לעמוד'}
              aria-pressed={doc?.fitMode === 'width'}
            >
              {doc?.fitMode === 'page' ? <IconFitWidth /> : <IconFitPage />}
            </button>
            <button
              type="button"
              className={`pdfr-btn${doc?.spread ? ' on' : ''}`}
              onClick={() => patchActive({ spread: !doc?.spread })}
              disabled={!doc}
              title={doc?.spread ? 'עמוד יחיד' : 'כפולת עמודים'}
              aria-label={doc?.spread ? 'עמוד יחיד' : 'כפולת עמודים'}
              aria-pressed={!!doc?.spread}
            >
              {doc?.spread ? <IconSingle /> : <IconSpread />}
            </button>
            {doc?.spread && (
              <button
                type="button"
                className={`pdfr-btn${doc.coverAlone ? ' on' : ''}`}
                onClick={() => patchActive({ coverAlone: !doc.coverAlone })}
                title="הזזת הצמדת העמודים"
                aria-label="הזזת הצמדת העמודים"
                aria-pressed={doc.coverAlone}
              >
                <IconShift />
              </button>
            )}
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => patchActive({ rotation: ((doc?.rotation || 0) + 90) % 360 })}
              disabled={!doc}
              title="סיבוב"
              aria-label="סיבוב"
            >
              <IconRotate />
            </button>
            <button
              type="button"
              className="pdfr-btn"
              onClick={toggleFullscreen}
              title="מסך מלא"
              aria-label="מסך מלא"
            >
              <IconExpand />
            </button>
          </div>
        </div>

        {docs.length > 0 && (
          <div className="pdfr-tabs" role="tablist" aria-label="ספרים פתוחים">
            {docs.map(d => (
              <div key={d.key} className={`pdfr-tab${d.key === activeKey ? ' active' : ''}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={d.key === activeKey}
                  className="pdfr-tab-label"
                  onClick={() => activate(d.key)}
                  title={d.title}
                >
                  {d.status === 'loading' && <span className="pdfr-tab-spin" aria-hidden="true" />}
                  <span className="pdfr-tab-title">{d.title}</span>
                </button>
                <button
                  type="button"
                  className="pdfr-tab-close"
                  onClick={() => closeDoc(d.key)}
                  title="סגירה"
                  aria-label={`סגירת ${d.title}`}
                >
                  <IconClose size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pdfr-stage-outer" ref={stageRef}>
          <div className="pdfr-stage">
            {pdfDoc && box.width > 0 && (
              <div className="pdfr-spread" style={{ direction: dir }}>
                {pages.map(n => (
                  <PdfPageView
                    key={`${doc.key}-${n}-${doc.rotation}`}
                    pdfDoc={pdfDoc}
                    pageNumber={n}
                    boxWidth={boxWidth}
                    boxHeight={boxHeight}
                    fitMode={doc.fitMode}
                    zoom={zoom}
                    rotation={doc.rotation}
                  />
                ))}
              </div>
            )}

            {doc?.status === 'loading' && (
              <div className="pdfr-loading" role="status" aria-live="polite">
                <span className="pdfr-spinner" aria-hidden="true" />
                <span className="pdfr-loading-title">{doc.title}</span>
                {loadingPct > 0 && <span className="pdfr-loading-pct">{loadingPct}%</span>}
              </div>
            )}

            {(doc?.status === 'error' || notice) && (
              <div className="pdfr-toast">{doc?.status === 'error' ? doc.error : notice}</div>
            )}

            {libraryOpen && (
              <>
                <div className="pdfr-library-veil" onClick={() => setLibraryOpen(false)} />
                <div className="pdfr-library" role="dialog" aria-label="ספרייה">
                  <div className="pdfr-library-head">
                    <IconLibrary />
                    <button
                      type="button"
                      className="pdfr-btn"
                      onClick={() => setLibraryOpen(false)}
                      title="סגירה"
                      aria-label="סגירה"
                    >
                      <IconClose />
                    </button>
                  </div>
                  <div className="pdfr-library-list">
                    {shelves.map(shelf => (
                      <div className="pdfr-library-shelf" key={shelf.kind}>
                        <div
                          className="pdfr-library-shelf-head"
                          role="heading"
                          aria-level={2}
                          title={shelf.label}
                          aria-label={shelf.label}
                        >
                          {shelf.icon}
                        </div>
                        {shelf.items.map(book => {
                          const inside = (
                            <>
                              <span className="pdfr-book-title">{book.title}</span>
                              <span className="pdfr-book-meta">
                                {[book.author, book.year].filter(Boolean).join(' · ')}
                                {book.resumePage ? (
                                  <span className="pdfr-book-page">עמוד {book.resumePage}</span>
                                ) : null}
                              </span>
                            </>
                          )
                          return book.href ? (
                            <Link
                              key={`${shelf.kind}-${book.id}`}
                              href={book.href}
                              className="pdfr-book"
                              title={book.title}
                            >
                              {inside}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              key={`${shelf.kind}-${book.id}`}
                              className={`pdfr-book${book.id === doc?.bookId ? ' on' : ''}`}
                              onClick={() => openBook(book, book.resumePage)}
                              title={book.title}
                            >
                              {inside}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                    {books.length === 0 && (
                      <div className="pdfr-library-empty">
                        הספרייה ריקה — הוסיפו קובצי PDF לתיקיית books שבמאגר
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </>
  )
}

/*
 * The library is data/library.json, written by `yarn book`: the shelf is a
 * manifest, and every file behind it is an asset of a GitHub release, fetched
 * through pages/api/book/[id].js.
 */
export function getStaticProps() {
  const { books } = require('../data/books')

  const shelf = books
    .map(b => ({
      id: b.id,
      title: b.title,
      // macOS writes "é" decomposed in a file name, and that spelling travels
      // into the manifest; ids and titles are composed here because they are
      // what links and comparisons carry.
      author: b.author || '',
      year: b.year ? String(b.year) : '',
      kind: b.kind === 'manuscript' ? 'manuscript' : 'book',
      dir: b.dir || null
    }))
    .map(b => ({ ...b, id: b.id.normalize('NFC'), title: b.title.normalize('NFC') }))
    .sort((a, b) => a.title.localeCompare(b.title, 'he'))

  return { props: { books: shelf } }
}
