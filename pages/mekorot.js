import Head from 'next/head'
import Link from 'next/link'
import AppNav from '../components/AppNav'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { sources } from '../data/sources'
import { markReferences, parseMarked, tokenizeMarked } from '../utils/sourceText'
import { analyzeStory, buildLegend } from '../utils/storyAnalysis'
import { calculateGematria } from '../utils/gematria'
import { edgePunctuation } from '../utils/storyAnalysis'
import { PAGE, downloadSheetPdf, layoutPages } from '../utils/sheetPdf'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Two pages open on their spine — the ספריה's icon for its two-page view.
const IconSpread = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 6.2C10.5 5.1 8.6 4.5 6.4 4.5H3.5v13h2.9c2.2 0 4.1.6 5.6 1.7 1.5-1.1 3.4-1.7 5.6-1.7h2.9v-13h-2.9c-2.2 0-4.1.6-5.6 1.7z" />
    <path d="M12 6.2v13" />
  </svg>
)

// Three swatches fanned out from one pin: the charter the sheet is set by — its
// tones, its type, its measures.
const IconCharter = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="4" y="3.5" width="6" height="17" rx="1.5" />
    <path d="M10 8.2 14.3 5.7a1.5 1.5 0 0 1 2 .55l2.4 4.2a1.5 1.5 0 0 1-.55 2L10 17.2" />
    <path d="M7 20.5h11.5a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-2" />
    <circle cx="7" cy="16.8" r="1" />
  </svg>
)

// An arrow coming down into a tray: a file for this machine — the ספריה's
// icon for opening one of its files, turned the other way.
const IconDownload = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 3.8V15" />
    <path d="M7.8 10.8 12 15l4.2-4.2" />
    <path d="M4.5 14.5v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />
  </svg>
)

// --- the four hands of the page -------------------------------------------
// Plain text, a verse, a letter the text is talking about, a number written
// with letters — each is set differently, the way a printed page sets them.

// Geresh and gershayim reach the screen only in an abbreviation — ואע״פ, י״י,
// one of ABBREVIATIONS — set as the Hebrew signs whatever the data typed.
// Everything else drops them:
// - a number written with letters, [כ״ב], and the numbers of a reference,
//   (משלי כ״ז:י״א): the ochre, or the reference's small grey, says it is a number;
// - a word the author marked to be counted, כת״ר תור״ה, עשרי״ם, הכ״ל: the
//   gematria rule under it says it now;
// - a string of letters the text speaks about, {א״ה}: the blue and the
//   letterform already say it is letters.
const bare = (text) => text.replace(/['"׳״]/g, '')
const signed = (text) => text.replace(/"/g, '״').replace(/'/g, '׳')
const ABBREVIATIONS = new Set(['ואע״פ', 'אע״פ', 'י״י', 'ר׳'])
const words = (text) =>
  text.replace(/[\u05d0-\u05ea'"׳״]+/g, (word) => (ABBREVIATIONS.has(signed(word)) ? signed(word) : bare(word)))

// The value of the text the reader has selected, and the runs of every block
// that add up to it: the page tints them all, as the ספור tab does.
const PICK_TINT = 'linear-gradient(rgba(150, 150, 150, 0.38), rgba(150, 150, 150, 0.38))'
const PickContext = createContext(null)

// A letter or a number that follows a prefix letter with nothing between them —
// מ[ד׳], ה[ג׳], ב{ה״א} — has lost the geresh that kept the two apart, and would
// read as one word (מד, הג); `glued` sets a hair of space between them.
function Piece({ text, kind, pickable, glued }) {
  const pick = useContext(PickContext)
  const cls = (name) => (glued ? `${name} src-glued` : name)
  if (kind === 'letter') return <span className={cls('src-letter')}>{bare(text)}</span>
  if (kind === 'num') {
    const value = calculateGematria(text)
    const picked = pickable && pick && pick.value === value
    return (
      <span className={cls('src-num')} title={`${value}`} style={picked ? { background: PICK_TINT } : undefined}>
        {bare(text)}
      </span>
    )
  }
  if (kind === 'verse') return <span className="src-verse-inline">{words(text)}</span>
  if (kind === 'ref') return <span className="src-ref">{words(text)}</span>
  return <>{words(text)}</>
}

const endsWithLetter = (text) => /\p{L}$/u.test(bare(text))

function Pieces({ pieces, pickable }) {
  return pieces.map((piece, i) => (
    <Piece
      key={i}
      {...piece}
      pickable={pickable}
      glued={(piece.kind === 'letter' || piece.kind === 'num') && i > 0 && endsWithLetter(pieces[i - 1].text)}
    />
  ))
}

// A block of running text, with the references picked out of the plain parts.
// It has no analysis of its own, so a selection reaches only its numbers.
function Marked({ text }) {
  const pieces = useMemo(() => markReferences(parseMarked(text)), [text])
  return <Pieces pieces={pieces} pickable />
}

// The pieces of a token between two character offsets, kinds preserved.
function slicePieces(pieces, from, to) {
  const out = []
  let pos = 0
  pieces.forEach((piece) => {
    const start = Math.max(from, pos)
    const end = Math.min(to, pos + piece.text.length)
    if (end > start) out.push({ ...piece, text: piece.text.slice(start - pos, end - pos) })
    pos += piece.text.length
  })
  return out
}

// The same text, drawn over the gematria the ספור tab finds in it: every word
// (or run of words) whose value is one of the chosen numbers gets its color's
// underline, stacked in lanes when several matches overlap.
//
// The rules hang from the word: lane 0 right under it — clear of the descent of
// ק and ן, never nearer the line below than the line it belongs to — and each
// further lane one pitch lower. Every counted word of a sheet takes the same
// padding, so a lane runs level from one word to the next.
const RULE = 3 // px, the thickness of a rule
const LANE = 5 // px from one lane's rule to the next
const RISE = 2 // px the first rule climbs into the empty foot of the word's box
const lanePadding = (laneCount) => LANE * (laneCount - 1) - RISE + RULE + 1

function MarkedWithGematria({ text, block, blockIndex, laneCount }) {
  const tokens = useMemo(() => tokenizeMarked(text), [text])
  const pick = useContext(PickContext)
  if (!block || block.tokens.length !== tokens.length) return <Marked text={text} />

  const picked = pick && pick.tokens.get(blockIndex)
  const bottomPad = lanePadding(laneCount)
  return tokens.map((token, i) => {
    const cover = block.tokenCover[i] || []
    const inPick = picked && picked.has(i)
    const pieces = markReferences(token.pieces)
    if (cover.length === 0 && !inPick) return <Pieces key={i} pieces={pieces} />
    const layers = cover.map((m) => {
      const fromFoot = bottomPad - (LANE * m.lane - RISE + RULE)
      return `linear-gradient(${m.color}, ${m.color}) left 0 bottom ${fromFoot}px / 100% ${RULE}px no-repeat`
    })
    if (inPick) layers.push(PICK_TINT)
    // The rule runs under the word, not under the comma that follows it.
    const { lead, trail } = edgePunctuation(token.plain)
    const end = token.plain.length - trail.length
    const from = end > lead.length ? lead.length : 0
    const to = end > lead.length ? end : token.plain.length
    return (
      <span key={i} className="src-token" data-b={blockIndex} data-t={i}>
        {from > 0 && <Pieces pieces={slicePieces(pieces, 0, from)} />}
        <span
          className="src-token-ink"
          style={{ background: layers.join(', '), paddingBottom: cover.length > 0 ? `${bottomPad}px` : undefined }}
        >
          <Pieces pieces={slicePieces(pieces, from, to)} />
        </span>
        {to < token.plain.length && <Pieces pieces={slicePieces(pieces, to, token.plain.length)} />}
      </span>
    )
  })
}

// A figure a color is already assigned to reads as that gematria, and is
// underlined in its color like the words of the text.
// A cell is a figure, optionally followed by its סימן in letters: `793 [תשצ״ג]`.
// The figure keeps the column's edge; the letters sit to its left, set like the text's.
const splitCell = (cell) => {
  const [, value = '', siman = ''] = cell.match(/^(\d*)\s*(.*)$/)
  return { value, siman }
}

function TableCell({ cell, legend }) {
  const { value, siman } = splitCell(cell)
  const figure = <Figure value={value} legend={legend} />
  if (!siman) return figure
  return (
    <span className="src-table-cell">
      <span className="src-table-siman"><Marked text={siman} /></span>
      {figure}
    </span>
  )
}

function Figure({ value, legend }) {
  const pick = useContext(PickContext)
  const color = legend && legend.get(Number(value))
  const picked = pick && value !== '' && pick.value === Number(value)
  if (!color && !picked) return <>{value}</>
  const layers = []
  if (color) layers.push(`linear-gradient(${color}, ${color}) left bottom / 100% 3px no-repeat`)
  if (picked) layers.push(PICK_TINT)
  return (
    <span className={color ? 'src-table-num' : undefined} style={{ background: layers.join(', ') }}>
      {value}
    </span>
  )
}

function Block({ block, gematria, laneCount, legend, index }) {
  if (block.type === 'verses') {
    return (
      <div className="src-verses">
        {block.verses.map((verse) => (
          <p className="src-verse" key={verse.n}>
            <span className="src-verse-num">{verse.n}</span>
            {verse.text}
          </p>
        ))}
      </div>
    )
  }

  if (block.type === 'table') {
    return (
      <table className="src-table">
        <thead>
          <tr>{block.head.map((cell, i) => <th key={i}>{cell}</th>)}</tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (c === 0
                ? <th key={c} scope="row"><Marked text={cell} /></th>
                : <td key={c}><TableCell cell={cell} legend={legend} /></td>))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const body =
    gematria
      ? <MarkedWithGematria text={block.text} block={gematria[index]} blockIndex={index} laneCount={laneCount} />
      : <Marked text={block.text} />

  if (block.type === 'intro') return <p className="src-intro">{body}</p>
  if (block.type === 'head') return <p className="src-head">{body}</p>
  if (block.type === 'label') return <p className="src-label">{body}</p>
  if (block.type === 'line') return <p className="src-line">{body}</p>
  if (block.type === 'row') return <p className="src-row">{body}</p>
  if (block.type === 'quote') return <blockquote className="src-blockquote">{body}</blockquote>
  if (block.type === 'list') {
    return (
      <p className="src-item">
        <span className="src-bullet" aria-hidden="true" />
        {body}
      </p>
    )
  }
  return (
    <p className="src-para">
      {block.lemma && <span className="src-lemma">{block.lemma}</span>}
      {body}
    </p>
  )
}

// One page of the two-page view, cut as the PDF cuts it: the text column — a
// window on the sheet's markup at the height of this page — and nothing else.
// No frame, no running head, no folio: the screen shows a page, not a printed
// sheet. A page past the last one (`page` null) is left blank, so the last
// spread is still two pages.
// The two-page view sets the text a size up, on the same leading (CSS, .src-print-screen).
const SPREAD_LOOK = 'src-print-screen'

function Leaf({ page, html, onClick, turn }) {
  return (
    <div
      className={`src-leaf${turn ? ` src-leaf-turn-${turn}` : ''}`}
      style={{ width: PAGE.width, height: PAGE.height }}
      onClick={turn ? onClick : undefined}
    >
      {page && (
        <div
          className={`src-leaf-text src-print ${SPREAD_LOOK}`}
          dir="rtl"
          style={{ top: PAGE.top, left: PAGE.side, width: PAGE.column, height: page.bottom - page.top }}
        >
          <div style={{ transform: `translateY(${-page.top}px)` }} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  )
}

export default function Mekorot() {
  const [activeId, setActiveId] = useState(sources[0].id)
  const [hoverTip, setHoverTip] = useState(null)
  const [pick, setPick] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [spread, setSpread] = useState(false)
  const [opening, setOpening] = useState(0)
  const [slide, setSlide] = useState(null)
  const [layout, setLayout] = useState(null)
  const [relayout, setRelayout] = useState(0)
  const [zoom, setZoom] = useState(1)
  const sheetRef = useRef(null)
  const pageRef = useRef(null)
  const tipRef = useRef(null)
  const source = sources.find((s) => s.id === activeId) || sources[0]

  // Deep link: /mekorot?src=…&view=pages&page=… — the source that is open, the
  // two-page view, and the spread it is open at (by its first page, the one on
  // the right). Read straight from the URL, this is a static page: once, on
  // mount. The page can only be reached once the pages are cut, so it waits.
  const [linked, setLinked] = useState(false)
  const wantedPage = useRef(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get('src')
    if (wanted && sources.some((s) => s.id === wanted)) setActiveId(wanted)
    if (params.get('view') === 'pages') {
      setSpread(true)
      const page = parseInt(params.get('page'), 10)
      if (page > 0) wantedPage.current = page
    }
    setLinked(true)
  }, [])

  const chooseSource = (id) => {
    setActiveId(id)
    setPick(null)
  }

  // Every block is analyzed on its own: a match can never cross a paragraph, so
  // block by block gives exactly the matches the whole text gives.
  const analysis = useMemo(() => {
    if (!source.numbers || source.numbers.length === 0) return null
    const legend = buildLegend(source.numbers)
    // `hide` names a run by value and phrase; the analysis keys each occurrence
    // separately, so the keys to drop are read off a first pass.
    const hidden = new Set(source.hide || [])
    const blocks = source.blocks.map((block) => {
      if (block.type === 'verses' || block.type === 'intro' || block.type === 'table') return null
      const tokens = tokenizeMarked(block.text)
      const text = tokens.map((t) => t.plain).join('')
      const found = analyzeStory(text, legend, [], false)
      if (hidden.size === 0) return found
      // A run the author wrote as a number or as letters is never noise, so a
      // `hide` entry never reaches one: כי the word goes, [כ״י] the number stays.
      const marked = tokens.map((t) => t.pieces.some((p) => p.kind === 'num' || p.kind === 'letter'))
      const covers = (m) => marked.slice(m.tokenStart, m.tokenEnd + 1).some(Boolean)
      const drop = found.matchList
        .filter((m) => hidden.has(m.key.split('#')[0]) && !covers(m))
        .map((m) => m.key)
      return drop.length === 0 ? found : analyzeStory(text, legend, drop, false)
    })
    const laneCount = blocks.reduce((max, b) => Math.max(max, b ? b.laneCount : 0), 0)
    return { legend, blocks, laneCount }
  }, [source])

  // The leading opens with the lanes the sheet stacks under its words, so the
  // lowest rule of a line never reaches the letters of the next one.
  const leading = analysis ? Math.max(1.9, 1.4 + analysis.laneCount * 0.27) : 1.9

  // Break the legend into even rows rather than letting the wrap fall where it
  // may: nine colors read as 5 + 4, not 8 + 1.
  const legendCols = useMemo(() => {
    const n = analysis ? analysis.legend.size : 0
    return n === 0 ? 1 : Math.ceil(n / Math.ceil(n / 6))
  }, [analysis])

  // The value behind a word, on hover: the gematriot a counted word carries, or
  // the number a run of letters spells.
  const showTip = (e) => {
    const sheet = sheetRef.current
    if (!sheet || !e.target.closest) { setHoverTip(null); return }
    const token = e.target.closest('.src-token')
    const num = e.target.closest('.src-num')
    let rows = null
    if (token && analysis) {
      const cover = analysis.blocks[Number(token.dataset.b)]?.tokenCover[Number(token.dataset.t)]
      const seen = new Map()
      ;(cover || []).forEach((m) => { if (!seen.has(m.key)) seen.set(m.key, m) })
      rows = Array.from(seen.values()).sort((a, b) => a.value - b.value)
    } else if (num) {
      rows = [{ key: 'n', value: calculateGematria(num.textContent), phrase: num.textContent }]
    }
    if (!rows || rows.length === 0) { setHoverTip(null); return }
    const anchor = token || num
    const sRect = sheet.getBoundingClientRect()
    const aRect = anchor.getBoundingClientRect()
    setHoverTip({
      rows,
      cx: aRect.left + aRect.width / 2 - sRect.left,
      topY: aRect.top - sRect.top,
      botY: aRect.bottom - sRect.top
    })
  }

  // Selecting a word, a run of words or a figure: its value is counted, and
  // every run on the page that adds up to it is tinted — words and numbers in
  // the text, figures and numbers in the tables. A figure is read as itself.
  const pickSelection = () => {
    const sheet = sheetRef.current
    const selection = window.getSelection()
    if (!sheet || !selection || selection.isCollapsed || selection.rangeCount === 0 ||
        !sheet.contains(selection.anchorNode) || !sheet.contains(selection.focusNode)) {
      setPick(null)
      return
    }
    const text = selection.toString().trim()
    const value = /^\d+$/.test(text) ? Number(text) : calculateGematria(text)
    if (!value) { setPick(null); return }
    const tokens = new Map()
    let count = 0
    ;(analysis ? analysis.blocks : []).forEach((b, index) => {
      if (!b) return
      const spans = b.findSpans(value)
      if (spans.length === 0) return
      const set = new Set()
      spans.forEach((sp) => { for (let t = sp.tokenStart; t <= sp.tokenEnd; t++) set.add(t) })
      tokens.set(index, set)
      count += spans.length
    })
    source.blocks.forEach((block) => {
      if (block.type === 'table') {
        block.rows.forEach((row) => row.forEach((cell, c) => {
          const { value: figure, siman } = c === 0 ? { value: '', siman: cell } : splitCell(cell)
          if (figure !== '' && Number(figure) === value) count++
          parseMarked(siman).forEach((p) => { if (p.kind === 'num' && calculateGematria(p.text) === value) count++ })
        }))
      } else if (block.type === 'intro' || !analysis) {
        parseMarked(block.text || '').forEach((p) => { if (p.kind === 'num' && calculateGematria(p.text) === value) count++ })
      }
    })
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const sRect = sheet.getBoundingClientRect()
    setHoverTip(null)
    setPick({
      value,
      count,
      tokens,
      cx: rect.left + rect.width / 2 - sRect.left,
      topY: rect.top - sRect.top,
      botY: rect.bottom - sRect.top
    })
  }

  // Keep the card inside the sheet on both axes, flipping under the word when
  // there is no room above it.
  useIsomorphicLayoutEffect(() => {
    const tip = tipRef.current
    const sheet = sheetRef.current
    const at = pick || hoverTip
    if (!tip || !sheet || !at) return
    const left = Math.max(6, Math.min(at.cx - tip.offsetWidth / 2, sheet.clientWidth - tip.offsetWidth - 6))
    let top = at.topY - tip.offsetHeight - 8
    if (top < 4) top = at.botY + 8
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
  }, [hoverTip, pick])

  // The sheet as a PDF file, set the way the screen sets it. The reader's pick
  // and the hover card go first: the file carries the sheet, not the moment.
  const downloadPdf = async () => {
    const sheet = sheetRef.current
    if (!sheet || exporting) return
    setExporting(true)
    setPick(null)
    setHoverTip(null)
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await downloadSheetPdf(sheet, source)
    } catch (error) {
      console.error('PDF export failed', error)
    } finally {
      setExporting(false)
    }
  }

  // The two-page view: the pages the PDF would have, side by side as in a bound
  // book — the first on the right. They are cut from the sheet, which stays in
  // the page, hidden, so the view follows the source that is open.
  useEffect(() => {
    if (!spread) { setLayout(null); return undefined }
    let live = true
    setPick(null)
    setHoverTip(null)
    requestAnimationFrame(() => {
      if (!sheetRef.current) return
      layoutPages(sheetRef.current, SPREAD_LOOK)
        .then((next) => {
          if (!live) return
          setLayout(next)
          const last = Math.ceil(next.pages.length / 2) - 1
          if (wantedPage.current) {
            setOpening(Math.min(last, Math.floor((wantedPage.current - 1) / 2)))
            wantedPage.current = null
          } else {
            setOpening((at) => Math.min(at, last))
          }
        })
        .catch((error) => console.error('Two-page view failed', error))
    })
    return () => { live = false }
  }, [spread, source, relayout])

  // A new source, or the view opened again, starts at the first spread.
  useEffect(() => {
    setOpening(0)
    setSlide(null)
  }, [spread, source])

  // The cuts are measured under the fonts and the stylesheet of the moment: a
  // face that arrives late, or a stylesheet that changes under the page, moves
  // the lines — so the pages are cut again, at the spread the reader is on.
  useEffect(() => {
    if (!spread) return undefined
    const again = () => setRelayout((n) => n + 1)
    document.fonts.addEventListener('loadingdone', again)
    const observer = new MutationObserver(again)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => {
      document.fonts.removeEventListener('loadingdone', again)
      observer.disconnect()
    }
  }, [spread])

  // One spread at a time, set at the size of the paper and scaled to the full
  // width the desk has for it — unless it
  // would then be taller than the window: then to the window's height.
  useIsomorphicLayoutEffect(() => {
    const area = pageRef.current
    if (!spread || !layout || !area) return undefined
    const fit = () => {
      const style = getComputedStyle(area)
      const width = area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      setZoom(Math.min(width / (2 * PAGE.width), height / PAGE.height))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(area)
    return () => observer.disconnect()
  }, [spread, layout])

  // Two pages to a spread; an odd count gets a blank page to close the last one.
  const openings = layout ? Math.ceil(layout.pages.length / 2) : 0
  const leavesOf = (at) => [2 * at, 2 * at + 1]

  // Turning slides the spreads side by side, the way the book lies: the next
  // one comes in from the left, the one before from the right. A turn asked for
  // while the pages are still moving waits for them; a reader who asked the
  // system for less motion gets the next spread at once.
  const turn = (step) => {
    const to = Math.max(0, Math.min(openings - 1, opening + step))
    if (to === opening || slide) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!still) setSlide({ from: opening, step })
    setOpening(to)
  }
  // The track holds the two spreads left to right, and moves from one to the other.
  const track = slide ? (slide.step > 0 ? [opening, slide.from] : [slide.from, opening]) : [opening]

  // The URL follows what is shown. It is written only once the link has been
  // read (`linked`, set in the render after the read): an earlier write would
  // put the default source back in the address before the read could see it.
  useEffect(() => {
    if (!linked) return
    const params = new URLSearchParams(window.location.search)
    params.set('src', activeId)
    if (spread) {
      params.set('view', 'pages')
      params.set('page', String(2 * opening + 1))
    } else {
      params.delete('view')
      params.delete('page')
    }
    const next = `${window.location.pathname}?${params}`
    if (next !== window.location.pathname + window.location.search) window.history.replaceState(null, '', next)
  }, [linked, activeId, spread, opening])

  // The arrows of the keyboard turn the pages the way the book reads: the next
  // spread lies to the left.
  useEffect(() => {
    if (!spread) return undefined
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') turn(1)
      if (e.key === 'ArrowRight') turn(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // The sheet's tools: the PDF, the two-page view, the charter. They sit at the
  // top-left of whatever is being read — the sheet's corner, or beside the
  // spread — and never leave the page.
  const tools = (
    <div className="src-tools src-screen-only">
      <button
        type="button"
        className="src-tool"
        onClick={downloadPdf}
        disabled={exporting}
        aria-busy={exporting}
        title="הורדת קובץ PDF"
        aria-label="הורדת קובץ PDF"
      >
        {exporting ? <span className="src-tool-spin" aria-hidden="true" /> : <IconDownload />}
      </button>
      <button
        type="button"
        className={`src-tool${spread ? ' on' : ''}`}
        onClick={() => setSpread((on) => !on)}
        aria-pressed={spread}
        title="עמודים — שני עמודים זה מול זה"
        aria-label="עמודים"
      >
        <IconSpread />
      </button>
      <Link href="/charte" className="src-tool" title="השפה הגרפית של הדף" aria-label="השפה הגרפית של הדף">
        <IconCharter />
      </Link>
    </div>
  )

  return (
    <>
      <Head>
        <title>ס.פ.ר — מקורות</title>
        <meta name="description" content="מקורות על הלשון, האותיות והמספר" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={`src-root${spread ? ' src-root-spread' : ''}`}>
        <AppNav current="library" />

        <div className="src-body">
          <nav className="src-list" aria-label="מקורות">
            {sources.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`src-list-item${item.id === source.id ? ' active' : ''}`}
                onClick={() => chooseSource(item.id)}
                aria-current={item.id === source.id ? 'true' : undefined}
              >
                <span className="src-list-title">{item.nav}</span>
                <span className="src-list-author">{item.author}</span>
                <span className="src-list-work">{item.book}</span>
              </button>
            ))}
          </nav>

          <article className="src-page" ref={pageRef}>
            {spread && (
              <div className="src-spread">
                {/* The one control the view keeps: the way back to the sheet,
                    floating in the corner. The pages turn from the keyboard's
                    arrows, or by a click on a page — the left one leads on,
                    the right one back, as in a book. */}
                <button
                  type="button"
                  className="src-tool on src-spread-close"
                  onClick={() => setSpread(false)}
                  aria-pressed="true"
                  title="חזרה לדף"
                  aria-label="עמודים"
                >
                  <IconSpread />
                </button>
                {/* Scaled with a transform, not `zoom`: a zoom lays the text out
                    again at the smaller size, and its lines no longer fall
                    where the pages were cut. */}
                <div className="src-spread-view" style={{ width: 2 * PAGE.width * zoom, height: PAGE.height * zoom }}>
                  <div
                    className="src-spread-scale"
                    style={{ width: 2 * PAGE.width, height: PAGE.height, transform: `scale(${zoom})` }}
                  >
                  {layout && (
                    <div
                      className={`src-spread-track${slide ? (slide.step > 0 ? ' src-slide-next' : ' src-slide-prev') : ''}`}
                      onAnimationEnd={() => setSlide(null)}
                    >
                      {track.map((at) => (
                        <div className="src-spread-row" key={at}>
                          {leavesOf(at).map((n, side) => (
                            <Leaf
                              key={n}
                              page={layout.pages[n] || null}
                              html={layout.html}
                              onClick={() => turn(side === 0 ? -1 : 1)}
                              turn={side === 0 ? (opening > 0 ? 'back' : null) : opening < openings - 1 ? 'on' : null}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              </div>
            )}

            <PickContext.Provider value={pick}>
              <div
                className="src-sheet"
                ref={sheetRef}
                style={spread ? { display: 'none' } : undefined}
                onMouseOver={pick ? undefined : showTip}
                onMouseLeave={() => setHoverTip(null)}
                onMouseUp={pickSelection}
              >
                {!spread && tools}

                <header className="src-header">
                  {/* A title is the book, the chapter under it, and the author */}
                  <h1 className="src-book">{words(source.book)}</h1>
                  <div className="src-chapter">{words(source.chapter)}</div>
                  <div className="src-author">{words(source.author)}</div>
                  {analysis && (
                    <div className="src-legend" style={{ '--legend-cols': legendCols }}>
                      {Array.from(analysis.legend.entries()).map(([value, color]) => (
                        <span className="src-legend-item" key={value}>
                          <span
                            className="src-legend-value"
                            style={{ background: `linear-gradient(${color}, ${color}) left bottom / 100% 3px no-repeat` }}
                          >
                            {value}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </header>

                <div className="src-text" style={{ '--src-leading': leading }}>
                  {source.blocks.map((block, index) => (
                    <Block
                      key={index}
                      index={index}
                      block={block}
                      gematria={analysis ? analysis.blocks : null}
                      laneCount={analysis ? analysis.laneCount : 0}
                      legend={analysis ? analysis.legend : null}
                    />
                  ))}
                </div>

                {pick && (
                  <div className="src-tip src-screen-only" ref={tipRef}>
                    <span className="src-tip-row">
                      <span className="src-tip-dot" style={{ background: 'rgba(150, 150, 150, 0.6)' }} aria-hidden="true" />
                      <span className="src-tip-value">{pick.value}</span>
                      <span className="src-tip-phrase">× {pick.count}</span>
                    </span>
                  </div>
                )}

                {!pick && hoverTip && (
                  <div className="src-tip src-screen-only" ref={tipRef}>
                    {hoverTip.rows.map((m) => (
                      <span className="src-tip-row" key={m.key}>
                        {m.color && <span className="src-tip-dot" style={{ background: m.color }} aria-hidden="true" />}
                        <span className="src-tip-value">{m.value}</span>
                        <span className="src-tip-phrase">{m.phrase}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </PickContext.Provider>
          </article>
        </div>
      </div>
    </>
  )
}
