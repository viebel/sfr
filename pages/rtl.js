import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { bookUrl } from '../data/books'

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

const IconOpen = () => (
  <Icon>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" />
    <path d="M3.2 9h17.6l-1.9 8.6A2 2 0 0 1 17 19H7a2 2 0 0 1-1.9-1.4z" />
  </Icon>
)
const IconLibrary = () => (
  <Icon>
    <path d="M4 4.5h3.5v15H4zM8.5 4.5H12v15H8.5z" />
    <path d="m14.2 5.6 3.4-.9 3 11.6-3.4.9z" />
    <path d="M4 19.5h16" />
  </Icon>
)
const IconClose = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
// In RTL, "back" points right and "forward" points left.
const IconBack = () => (
  <Icon>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)
const IconForward = () => (
  <Icon>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)
const IconFirst = () => (
  <Icon>
    <path d="M6 5l7 7-7 7" />
    <path d="M13 5l5 7-5 7" />
  </Icon>
)
const IconLast = () => (
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
const IconHome = () => (
  <Icon>
    <path d="M3.5 11 12 3.5l8.5 7.5" />
    <path d="M5.8 9.9V20h12.4V9.9" />
  </Icon>
)
const IconDoc = ({ size = 44 }) => (
  <Icon size={size}>
    <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
    <path d="M14 3.5v5h5" />
    <path d="M8.5 13h7M8.5 16.5h4.5" />
  </Icon>
)

// A spread groups pages so that, in RTL, the lower page number sits on the right.
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

export default function RtlReader({ books = [] }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [pageDraft, setPageDraft] = useState('1')
  const [spread, setSpread] = useState(true)
  const [coverAlone, setCoverAlone] = useState(true)
  const [fitMode, setFitMode] = useState('page')
  const [zoomIndex, setZoomIndex] = useState(zoomSteps.indexOf(1))
  const [rotation, setRotation] = useState(0)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [bookId, setBookId] = useState('')

  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const fileInputRef = useRef(null)
  const docRef = useRef(null)
  const pendingPageRef = useRef(null)
  const openTokenRef = useRef(0)
  const [box, setBox] = useState({ width: 0, height: 0 })

  const zoom = zoomSteps[zoomIndex]
  const pages = pdfDoc ? groupPages(page, spread, coverAlone, numPages) : []

  // --- document loading -----------------------------------------------------

  const openSource = useCallback(async (source, name) => {
    // Opening a second file while the first is still parsing must not leave the
    // slower one to win, so only the newest token is allowed to install a doc.
    const token = ++openTokenRef.current
    setStatus('loading')
    setError('')
    try {
      const pdfjs = await loadPdfjs()
      const task = pdfjs.getDocument({ ...pdfjsOptions, ...source })
      const doc = await task.promise
      if (token !== openTokenRef.current) {
        task.destroy()
        return
      }
      docRef.current?.loadingTask?.destroy()
      docRef.current = doc
      setPdfDoc(doc)
      setNumPages(doc.numPages)
      const wanted = pendingPageRef.current
      pendingPageRef.current = null
      const start = Math.min(Math.max(wanted || 1, 1), doc.numPages)
      setPage(start)
      setPageDraft(String(start))
      setFileName(name)
      setStatus('ready')
    } catch (e) {
      if (token !== openTokenRef.current) return
      setStatus('error')
      setError(e?.message || 'לא ניתן לפתוח את הקובץ')
    }
  }, [])

  const openFile = useCallback(
    async file => {
      if (!file) return
      if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
        setStatus('error')
        setError('הקובץ אינו PDF')
        return
      }
      const data = new Uint8Array(await file.arrayBuffer())
      setBookId('')
      openSource({ data }, file.name)
    },
    [openSource]
  )

  // A book of the library is fetched from GitHub by URL; only its id travels in
  // the address bar, so the link stays short and survives a move of the files.
  const openBook = useCallback(
    book => {
      if (!book) return
      setLibraryOpen(false)
      setBookId(book.id)
      setFileName(book.title)
      const params = new URLSearchParams(window.location.search)
      params.delete('url')
      params.delete('page')
      params.set('book', book.id)
      window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
      openSource({ url: bookUrl(book.file) }, book.title)
    },
    [openSource]
  )

  // Deep link: /rtl?book=...&page=... or /rtl?url=...&page=... — read straight
  // from the URL, since this is a static page and router.query is only
  // populated after hydration settles.
  useEffect(() => {
    if (openTokenRef.current > 0) return
    const params = new URLSearchParams(window.location.search)
    const wanted = parseInt(params.get('page'), 10)
    if (Number.isFinite(wanted) && wanted > 0) pendingPageRef.current = wanted
    const id = params.get('book')
    if (id) {
      const book = books.find(b => b.id === id)
      if (book) {
        setBookId(book.id)
        setFileName(book.title)
        openSource({ url: bookUrl(book.file) }, book.title)
      } else {
        setStatus('error')
        setError('הספר לא נמצא בספרייה')
      }
      return
    }
    const url = params.get('url')
    if (url) openSource({ url }, decodeURIComponent(url.split('/').pop() || 'PDF'))
  }, [openSource, books])

  useEffect(() => () => docRef.current?.loadingTask?.destroy(), [])

  // Keep ?page= in sync so a reload (or a shared link) resumes where you were.
  useEffect(() => {
    if (!pdfDoc) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('page') === String(page)) return
    params.set('page', String(page))
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }, [page, pdfDoc])

  // --- navigation -----------------------------------------------------------

  const goTo = useCallback(
    n => {
      if (!numPages) return
      const clamped = Math.min(Math.max(n, 1), numPages)
      setPage(clamped)
      setPageDraft(String(clamped))
    },
    [numPages]
  )

  const goForward = useCallback(() => {
    const shown = groupPages(page, spread, coverAlone, numPages)
    const next = shown[shown.length - 1] + 1
    if (next <= numPages) goTo(groupStart(next, spread, coverAlone))
  }, [page, spread, coverAlone, numPages, goTo])

  const goBack = useCallback(() => {
    const start = groupStart(page, spread, coverAlone)
    if (start > 1) goTo(groupStart(start - 1, spread, coverAlone))
  }, [page, spread, coverAlone, goTo])

  const atStart = pages.length > 0 && groupStart(page, spread, coverAlone) <= 1
  const atEnd = pages.length > 0 && pages[pages.length - 1] >= numPages

  const zoomBy = useCallback(delta => {
    setZoomIndex(i => Math.min(Math.max(i + delta, 0), zoomSteps.length - 1))
  }, [])

  // --- keyboard -------------------------------------------------------------

  useEffect(() => {
    const onKey = e => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        // RTL: moving left goes forward in the book, moving right goes back.
        case 'ArrowLeft':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          goForward()
          break
        case 'ArrowRight':
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
          setZoomIndex(zoomSteps.indexOf(1))
          break
        default:
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goForward, goBack, goTo, zoomBy, numPages])

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
  }, [status])

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

  const submitPage = e => {
    e.preventDefault()
    const n = parseInt(pageDraft, 10)
    if (Number.isFinite(n)) goTo(n)
    else setPageDraft(String(page))
  }

  return (
    <>
      <Head>
        <title>ס.פ.ר — קורא PDF מימין לשמאל</title>
        <meta name="description" content="קריאת קבצי PDF בכיוון ימין לשמאל" />
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
        <div className="pdfr-toolbar">
          <div className="pdfr-toolbar-group">
            <Link href="/" className="pdfr-btn" title="ס.פ.ר" aria-label="חזרה לס.פ.ר">
              <IconHome />
            </Link>
            <nav className="src-subtabs">
              <Link href="/rtl" className="src-subtab active" aria-current="page">קורא</Link>
              <Link href="/mekorot" className="src-subtab">מקורות</Link>
            </nav>
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
              className={`pdfr-btn${libraryOpen ? ' on' : ''}`}
              onClick={() => setLibraryOpen(o => !o)}
              title="ספרייה"
              aria-label="ספרייה"
              aria-expanded={libraryOpen}
            >
              <IconLibrary />
            </button>
            {fileName && <span className="pdfr-filename">{fileName}</span>}
          </div>

          <div className="pdfr-toolbar-group">
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => goTo(1)}
              disabled={!pdfDoc || atStart}
              title="לעמוד הראשון"
              aria-label="לעמוד הראשון"
            >
              <IconFirst />
            </button>
            <button
              type="button"
              className="pdfr-btn"
              onClick={goBack}
              disabled={!pdfDoc || atStart}
              title="אחורה"
              aria-label="אחורה"
            >
              <IconBack />
            </button>
            <form className="pdfr-pagebox" onSubmit={submitPage}>
              <input
                type="text"
                inputMode="numeric"
                className="pdfr-page-input"
                value={pageDraft}
                disabled={!pdfDoc}
                onChange={e => setPageDraft(e.target.value.replace(/[^0-9]/g, ''))}
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
              <IconForward />
            </button>
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => goTo(numPages)}
              disabled={!pdfDoc || atEnd}
              title="לעמוד האחרון"
              aria-label="לעמוד האחרון"
            >
              <IconLast />
            </button>
          </div>

          <div className="pdfr-toolbar-group">
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => zoomBy(-1)}
              disabled={zoomIndex === 0}
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
              disabled={zoomIndex === zoomSteps.length - 1}
              title="הגדלה"
              aria-label="הגדלה"
            >
              <IconZoomIn />
            </button>
            <button
              type="button"
              className={`pdfr-btn${fitMode === 'width' ? ' on' : ''}`}
              onClick={() => setFitMode(m => (m === 'page' ? 'width' : 'page'))}
              title={fitMode === 'page' ? 'התאמה לרוחב' : 'התאמה לעמוד'}
              aria-label={fitMode === 'page' ? 'התאמה לרוחב' : 'התאמה לעמוד'}
              aria-pressed={fitMode === 'width'}
            >
              {fitMode === 'page' ? <IconFitWidth /> : <IconFitPage />}
            </button>
            <button
              type="button"
              className={`pdfr-btn${spread ? ' on' : ''}`}
              onClick={() => setSpread(s => !s)}
              title={spread ? 'עמוד יחיד' : 'כפולת עמודים'}
              aria-label={spread ? 'עמוד יחיד' : 'כפולת עמודים'}
              aria-pressed={spread}
            >
              {spread ? <IconSingle /> : <IconSpread />}
            </button>
            {spread && (
              <button
                type="button"
                className={`pdfr-btn${coverAlone ? ' on' : ''}`}
                onClick={() => setCoverAlone(c => !c)}
                title="הזזת הצמדת העמודים"
                aria-label="הזזת הצמדת העמודים"
                aria-pressed={coverAlone}
              >
                <IconShift />
              </button>
            )}
            <button
              type="button"
              className="pdfr-btn"
              onClick={() => setRotation(r => (r + 90) % 360)}
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

        <div className="pdfr-stage-outer" ref={stageRef}>
          <div className="pdfr-stage">
            {pdfDoc && box.width > 0 && (
              <div className="pdfr-spread">
                {pages.map(n => (
                  <PdfPageView
                    key={`${n}-${rotation}`}
                    pdfDoc={pdfDoc}
                    pageNumber={n}
                    boxWidth={boxWidth}
                    boxHeight={boxHeight}
                    fitMode={fitMode}
                    zoom={zoom}
                    rotation={rotation}
                  />
                ))}
              </div>
            )}

            {!pdfDoc && (
              <div className="pdfr-empty">
                <div className="pdfr-empty-card">
                  <IconDoc />
                  <div className="pdfr-empty-title">קריאת PDF מימין לשמאל</div>
                  <div className="pdfr-empty-text">
                    גררו לכאן קובץ PDF, או פתחו קובץ בעזרת הכפתור
                  </div>
                  <div className="pdfr-empty-actions">
                    <button
                      type="button"
                      className="pdfr-btn pdfr-btn-lg"
                      onClick={() => fileInputRef.current?.click()}
                      title="פתיחת קובץ PDF"
                      aria-label="פתיחת קובץ PDF"
                    >
                      <IconOpen />
                    </button>
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
                  </div>
                  {status === 'loading' && <div className="pdfr-empty-note">טוען…</div>}
                  {status === 'error' && <div className="pdfr-empty-error">{error}</div>}
                </div>
              </div>
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
                    {books.map(book => (
                      <button
                        type="button"
                        key={book.id}
                        className={`pdfr-book${book.id === bookId ? ' on' : ''}`}
                        onClick={() => openBook(book)}
                        title={book.title}
                      >
                        <span className="pdfr-book-title">{book.title}</span>
                        {(book.author || book.year) && (
                          <span className="pdfr-book-meta">
                            {[book.author, book.year].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
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

            {pdfDoc && status === 'error' && <div className="pdfr-toast">{error}</div>}
          </div>
        </div>

        <div className="pdfr-hint">
          ← קדימה · → אחורה · +/− זום
        </div>
      </div>
    </>
  )
}

/*
 * The library is the books/ folder of the repo, read at build time: a PDF
 * dropped there needs no code change to appear. Only names travel to the
 * client — the files themselves are fetched from GitHub (see data/books.js).
 */
export function getStaticProps() {
  const fs = require('fs')
  const path = require('path')
  const { bookMeta } = require('../data/books')

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
        year: meta.year ? String(meta.year) : ''
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'he'))

  return { props: { books } }
}
