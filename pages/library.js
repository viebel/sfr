import Head from 'next/head'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppNav from '../components/AppNav'
import { bookHref } from '../data/books'
import { lastPageOf, readHistory, recordRead } from '../utils/readingHistory'

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
// disableFontFace draws glyph outlines instead of installing an @font-face: the
// browser's own advance widths do not match the PDF's, which visibly scatters
// the letters of embedded Hebrew fonts.
const pdfjsOptions = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
  disableFontFace: true
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
const IconDoc = ({ size = 44 }) => (
  <Icon size={size}>
    <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
    <path d="M14 3.5v5h5" />
    <path d="M8.5 13h7M8.5 16.5h4.5" />
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

      const outputScale = Math.min(window.devicePixelRatio || 1, 3)
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      setSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height), scale })

      const context = canvas.getContext('2d', { alpha: false })
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
function newDoc({ key, title, bookId, dir, page }) {
  return {
    key,
    title,
    bookId: bookId || '',
    dir,
    status: 'loading', // loading | ready | error
    error: '',
    progress: 0,
    pdfDoc: null,
    numPages: 0,
    page: page || 1,
    pageDraft: String(page || 1),
    spread: true,
    coverAlone: true,
    fitMode: 'page',
    zoomIndex: zoomSteps.indexOf(1),
    rotation: 0
  }
}

export default function Library({ books = [] }) {
  const [docs, setDocs] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [history, setHistory] = useState([])

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

  const openDoc = useCallback(
    async ({ source, title, bookId = '', dir: wanted, page }) => {
      // A book already open is brought forward rather than loaded a second time.
      if (bookId) {
        const open = docsRef.current.find(d => d.bookId === bookId)
        if (open) {
          setActiveKey(open.key)
          if (page) patchDoc(open.key, { page, pageDraft: String(page) })
          setLibraryOpen(false)
          return
        }
      }

      // Where to land: an explicit page wins, then wherever this book was left.
      const start = page || (bookId ? lastPageOf(bookId) : 0) || 1
      const key = `doc${++keySeqRef.current}`
      setDocs(ds => [
        ...ds,
        newDoc({ key, title, bookId, dir: guessDir(title, wanted), page: start })
      ])
      setActiveKey(key)
      setLibraryOpen(false)

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
        const landing = Math.min(Math.max(start, 1), pdf.numPages)
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
        source: { url: bookHref(book) },
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

  // Deep link: /library?book=…&page=… or ?url=… — read straight from the URL,
  // since this is a static page and router.query is only populated after
  // hydration settles.
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    setHistory(readHistory())
    const params = new URLSearchParams(window.location.search)
    const wanted = parseInt(params.get('page'), 10)
    const page = Number.isFinite(wanted) && wanted > 0 ? wanted : undefined
    const id = params.get('book')
    if (id) {
      const book = books.find(b => b.id === id)
      if (book) openBook(book, page)
      return
    }
    const url = params.get('url')
    if (url) {
      const name = decodeURIComponent(url.split('/').pop() || 'PDF')
      openDoc({ source: { url }, title: name, page })
    }
  }, [books, openBook, openDoc])

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

  // The reading memory, written as you turn pages.
  useEffect(() => {
    if (!doc || doc.status !== 'ready' || !doc.bookId) return
    const timer = setTimeout(() => {
      recordRead({ id: doc.bookId, title: doc.title, page: doc.page, numPages: doc.numPages })
      setHistory(readHistory())
    }, 600)
    return () => clearTimeout(timer)
  }, [doc])

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

  // Printed books and manuscripts are two shelves of the same library, and what
  // you were reading is a third one — the one you reach for most.
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=David+Libre:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
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
        <div className="pdfr-appnav">
          <AppNav current="library" compact />
        </div>

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
              onClick={() => patchActive({ fitMode: doc?.fitMode === 'page' ? 'width' : 'page' })}
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
                  onClick={() => setActiveKey(d.key)}
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

            {!doc && (
              <div className="pdfr-empty">
                <div className="pdfr-empty-card">
                  <IconDoc />
                  <div className="pdfr-empty-title">ספרייה</div>
                  <div className="pdfr-empty-text">
                    בחרו ספר מהספרייה, גררו לכאן קובץ PDF, או פתחו קובץ בעזרת הכפתור
                  </div>
                  <div className="pdfr-empty-actions">
                    {books.length > 0 && (
                      <button
                        type="button"
                        className="pdfr-btn pdfr-btn-lg"
                        onClick={() => setLibraryOpen(true)}
                        title="ספרייה"
                        aria-label="ספרייה"
                      >
                        <IconLibrary />
                      </button>
                    )}
                    <button
                      type="button"
                      className="pdfr-btn pdfr-btn-lg"
                      onClick={() => fileInputRef.current?.click()}
                      title="פתיחת קובץ PDF"
                      aria-label="פתיחת קובץ PDF"
                    >
                      <IconOpen />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {doc?.status === 'loading' && (
              <div className="pdfr-loading" role="status" aria-live="polite">
                <span className="pdfr-spinner" aria-hidden="true" />
                <span className="pdfr-loading-title">{doc.title}</span>
                {loadingPct > 0 && <span className="pdfr-loading-pct">{loadingPct}%</span>}
              </div>
            )}

            {doc?.status === 'error' && <div className="pdfr-toast">{doc.error}</div>}

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
                        {shelf.items.map(book => (
                          <button
                            type="button"
                            key={`${shelf.kind}-${book.id}`}
                            className={`pdfr-book${book.id === doc?.bookId ? ' on' : ''}`}
                            onClick={() => openBook(book, book.resumePage)}
                            title={book.title}
                          >
                            <span className="pdfr-book-title">{book.title}</span>
                            <span className="pdfr-book-meta">
                              {[book.author, book.year].filter(Boolean).join(' · ')}
                              {book.resumePage ? (
                                <span className="pdfr-book-page">עמוד {book.resumePage}</span>
                              ) : null}
                            </span>
                          </button>
                        ))}
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

        <div className="pdfr-hint">{rtl ? '← קדימה · → אחורה · +/− זום' : '→ קדימה · ← אחורה · +/− זום'}</div>
      </div>
    </>
  )
}

/*
 * The library is the books/ folder of the repo, read at build time: a PDF
 * dropped there needs no code change to appear. Books too large for git are
 * declared in data/books.js and served from a GitHub release.
 */
export function getStaticProps() {
  const fs = require('fs')
  const path = require('path')
  const { bookMeta, releaseBooks } = require('../data/books')

  const root = path.join(process.cwd(), 'books')

  const walk = dir =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) return walk(full)
          return /\.pdf$/i.test(entry.name) ? [path.relative(root, full)] : []
        })
      : []

  const books = walk(root)
    .map(file => {
      const meta = bookMeta[file] || {}
      const name = file.replace(/\.pdf$/i, '')
      return {
        id: meta.id || name,
        file,
        title: meta.title || path.basename(name),
        author: meta.author || '',
        year: meta.year ? String(meta.year) : '',
        kind: meta.kind === 'manuscript' ? 'manuscript' : 'book',
        dir: meta.dir || null
      }
    })
    .concat(releaseBooks.map(b => ({ dir: null, ...b })))
    .sort((a, b) => a.title.localeCompare(b.title, 'he'))

  return { props: { books } }
}
