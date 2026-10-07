import Head from 'next/head'
import AppNav from '../components/AppNav'
import Composer from '../components/Composer'
import { Fragment, cloneElement, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { sources } from '../data/sources'
import { markReferences, parseMarked, tokenizeMarked } from '../utils/sourceText'
import { analyzeStory, buildLegend } from '../utils/storyAnalysis'
import { calculateGematria } from '../utils/gematria'
import { edgePunctuation } from '../utils/storyAnalysis'
import { PAGE, downloadSheetPdf, downloadSpreadPdf, layoutPages } from '../utils/sheetPdf'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Composition writes the source's file, so it exists only where there is a
// repository to write to: on the machine that runs `yarn dev`, never online.
const CAN_COMPOSE = process.env.NODE_ENV === 'development'

// A pen on a line: the text and its setting, by hand.
const IconCompose = () => (
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
    <path d="M4 20h16" />
    <path d="M14.5 4.5l3 3L9 16l-4 1 1-4z" />
  </svg>
)

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

// The space after a letter or a number written with letters never breaks — a
// letter is not left alone at the end of a line, away from the words that
// follow it: [ו׳] פעמים, {אב״ג} כנגד, {ב״א}, וכן (past a mark of punctuation
// too). It is set as a no-break space on the page only, and the analysis reads
// the same text, so its words and the page's stay one for one (a no-break space
// is still a space to both).
const bind = (text) =>
  text.replace(/([}\]][,.:;!?)״׳'"]*)( +)/g, (_, mark, run) => mark + '\u00a0'.repeat(run.length))
const signed = (text) => text.replace(/"/g, '״').replace(/'/g, '׳')
const ABBREVIATIONS = new Set(['ואע״פ', 'אע״פ', 'י״י', 'ר׳'])
const words = (text) =>
  text.replace(/[\u05d0-\u05ea'"׳״]+/g, (word) => (ABBREVIATIONS.has(signed(word)) ? signed(word) : bare(word)))

// The value of the text the reader has selected, and the runs of every block
// that add up to it: the page tints them all, as the ספור tab does.
const PICK_TINT = 'linear-gradient(rgba(150, 150, 150, 0.38), rgba(150, 150, 150, 0.38))'
const PickContext = createContext(null)

// While composing, the spaces that make a layout are shown: a run of spaces —
// at the head of a line, or two and more in a row — gets a dot under each
// space, and a line break its ↵. They are drawn, not typed: the text and its
// widths are unchanged, and nothing of it reaches the PDF.
const ComposingContext = createContext(false)

function Spaces({ text, atStart }) {
  const composing = useContext(ComposingContext)
  // `atStart`: the text opens its block, so a single space at its head is a layout too
  const runs = atStart ? /( {2,}|^ +|\n +|\n)/ : /( {2,}|\n +|\n)/
  if (!composing || !runs.test(text)) return <>{text}</>
  return text.split(runs).map((part, i) => {
    if (!part) return null
    if (part.startsWith('\n')) {
      return (
        <Fragment key={i}>
          <span className="src-shown-break" aria-hidden="true">↵</span>
          {'\n'}
          {part.length > 1 && <span className="src-shown-space">{part.slice(1)}</span>}
        </Fragment>
      )
    }
    return / /.test(part) && part.trim() === '' ? <span key={i} className="src-shown-space">{part}</span> : part
  })
}

// A letter or a number that follows a prefix letter with nothing between them —
// מ[ד׳], ה[ג׳], ב{ה״א} — has lost the geresh that kept the two apart, and would
// read as one word (מד, הג); `glued` sets a hair of space between them.
function Piece({ text, kind, pickable, glued, atStart }) {
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
  return <Spaces text={words(text)} atStart={atStart} />
}

const endsWithLetter = (text) => /\p{L}$/u.test(bare(text))

function Pieces({ pieces, pickable, atStart }) {
  return pieces.map((piece, i) => (
    <Piece
      key={i}
      {...piece}
      pickable={pickable}
      atStart={atStart && i === 0}
      glued={(piece.kind === 'letter' || piece.kind === 'num') && i > 0 && endsWithLetter(pieces[i - 1].text)}
    />
  ))
}

// A block of running text, with the references picked out of the plain parts.
// It has no analysis of its own, so a selection reaches only its numbers.
function Marked({ text }) {
  const pieces = useMemo(() => markReferences(parseMarked(bind(text))), [text])
  return <Pieces pieces={pieces} pickable atStart />
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
const RULE = 2 // px, shared by text, table figures and legend values
const LANE = 5 // px from one lane's rule to the next
const RISE = 2 // px the first rule climbs into the empty foot of the word's box
const lanePadding = (laneCount) => LANE * (laneCount - 1) - RISE + RULE + 1

function MarkedWithGematria({ text, block, blockIndex, laneCount }) {
  const tokens = useMemo(() => tokenizeMarked(bind(text)), [text])
  const pick = useContext(PickContext)
  if (!block || block.tokens.length !== tokens.length) return <Marked text={text} />

  const picked = pick && pick.tokens.get(blockIndex)
  const bottomPad = lanePadding(laneCount)
  return tokens.map((token, i) => {
    const cover = block.tokenCover[i] || []
    const inPick = picked && picked.has(i)
    const pieces = markReferences(token.pieces)
    if (cover.length === 0 && !inPick) return <Pieces key={i} pieces={pieces} atStart={i === 0} />
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
  if (color) layers.push(`linear-gradient(${color}, ${color}) left bottom / 100% ${RULE}px no-repeat`)
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

  // A row of cells of one width, centered: two grids of as many cells line up
  // column for column, whatever stands between them.
  if (block.type === 'grid') {
    return (
      <div className="src-grid" style={{ '--grid-cols': block.cells.length }}>
        {block.cells.map((cell, i) => (
          <span className="src-grid-cell" key={i}><Marked text={cell} /></span>
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

// A block set in from the side its lines start on, by `indent` twelfths of the
// line (pages/mekorot.js, the composition panel's − and +).
const INDENT_STEPS = 9
function indented(block) {
  const steps = Math.max(0, Math.min(INDENT_STEPS, Math.round(block.indent || 0)))
  return steps ? { marginInlineStart: `${(steps * 100) / 12}%` } : undefined
}

// The space after a block, when the composition has set it: `space` quarters
// of the paragraph space (1.15rem), from 0 — the next block right under it — to
// 8, twice the usual. The block after it then keeps no margin of its own, so
// the gap is exactly this one.
const SPACE_STEP = 1.15 / 4
const MAX_SPACE = 8
function spaced(block, previous) {
  const style = {}
  if (block.space !== undefined) style.marginBottom = `${Math.max(0, Math.min(MAX_SPACE, block.space)) * SPACE_STEP}rem`
  if (previous && previous.space !== undefined) style.marginTop = 0
  if (block.spaceBefore !== undefined) style.marginTop = `${Math.max(0, block.spaceBefore) * SPACE_STEP}rem`
  return style
}

// One page of the two-page view, cut as the PDF cuts it: the text column — a
// window on the sheet's markup at the height of this page — and nothing else.
// No frame, no running head, no folio: the screen shows a page, not a printed
// sheet. A page past the last one (`page` null) is left blank, so the last
// spread is still two pages.
// The two-page view sets the text a size up, on the same leading (CSS, .src-print-screen).
const SPREAD_LOOK = 'src-print-screen'

function Leaf({ page, html, onClick, turn, onSelectBlock }) {
  return (
    <div
      className={`src-leaf${turn ? ` src-leaf-turn-${turn}` : ''}`}
      style={{ width: PAGE.width, height: PAGE.height }}
      onClick={onSelectBlock || (turn ? onClick : undefined)}
    >
      {page && !page.blank && (
        <div
          className={`src-leaf-text src-print ${SPREAD_LOOK}`}
          dir="rtl"
          style={{ top: page.marginTop, left: PAGE.side, width: PAGE.column, height: page.bottom - page.top }}
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
  const [composing, setComposing] = useState(false)
  const [focusedBlock, setFocusedBlock] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveError, setSaveError] = useState('')
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

  // While composing, the sheet is drawn from the draft, as it is being changed.
  const sheetBlocks = composing && draft ? draft : source.blocks
  const dirty = composing && draft !== null && JSON.stringify(draft) !== JSON.stringify(source.blocks)

  // Every block is analyzed on its own: a match can never cross a paragraph, so
  // block by block gives exactly the matches the whole text gives.
  const analysis = useMemo(() => {
    if (!source.numbers || source.numbers.length === 0) return null
    const legend = buildLegend(source.numbers)
    // `hide` names a run by value and phrase; the analysis keys each occurrence
    // separately, so the keys to drop are read off a first pass.
    // An entry written `!value|phrase` drops its run even over letters or a
    // number: the reader has looked at that run and does not keep it.
    const hidden = new Set((source.hide || []).filter((h) => !h.startsWith('!')))
    const forced = new Set((source.hide || []).filter((h) => h.startsWith('!')).map((h) => h.slice(1)))
    const blocks = sheetBlocks.map((block) => {
      if (block.type === 'verses' || block.type === 'intro' || block.type === 'table' || block.type === 'grid') return null
      const tokens = tokenizeMarked(bind(block.text))
      const text = tokens.map((t) => t.plain).join('')
      const found = analyzeStory(text, legend, [], false)
      if (hidden.size === 0 && forced.size === 0) return found
      // A run the author wrote as a number or as letters is never noise, so a
      // `hide` entry never reaches one: כי the word goes, [כ״י] the number stays.
      const marked = tokens.map((t) => t.pieces.some((p) => p.kind === 'num' || p.kind === 'letter'))
      const covers = (m) => marked.slice(m.tokenStart, m.tokenEnd + 1).some(Boolean)
      const drop = found.matchList
        .filter((m) => forced.has(m.key.split('#')[0]) || (hidden.has(m.key.split('#')[0]) && !covers(m)))
        .map((m) => m.key)
      return drop.length === 0 ? found : analyzeStory(text, legend, drop, false)
    })
    const laneCount = blocks.reduce((max, b) => Math.max(max, b ? b.laneCount : 0), 0)
    return { legend, blocks, laneCount }
  }, [source, sheetBlocks])

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
    sheetBlocks.forEach((block) => {
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
      // From the two-page view, the file is the view: landscape, a spread to a sheet.
      if (spread) await downloadSpreadPdf(sheet, source, SPREAD_LOOK)
      else await downloadSheetPdf(sheet, source)
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
  }, [spread, source, sheetBlocks, composing, relayout])

  // A new source, or the view opened again, starts at the first spread.
  useEffect(() => {
    setOpening(0)
    setSlide(null)
  }, [spread, activeId])

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
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
      if (e.key === 'ArrowLeft') turn(1)
      if (e.key === 'ArrowRight') turn(-1)
      if (e.key === 'Home') turn(-opening)
      if (e.key === 'End') turn(openings - 1 - opening)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Composition: a draft of the blocks, edited beside the sheet that shows it,
  // and written to the source's file as it changes — a second at most after a
  // change, one write for a burst of them, always the latest draft.
  const openComposer = () => {
    setFocusedBlock(null)
    setSlide(null)
    // A block of the former `indent` type is opened as a paragraph set in by a third
    setDraft(JSON.parse(JSON.stringify(source.blocks)).map((b) => (b.type === 'indent' ? { ...b, type: 'para', indent: b.indent ?? 4 } : b)))
    setSaveStatus('idle')
    setPick(null)
    setHoverTip(null)
    setComposing(true)
  }
  const closeComposer = () => {
    // What is still waiting for its second is written before the panel goes
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      saveDraft(draftRef.current)
    }
    setComposing(false)
    setFocusedBlock(null)
    setDraft(null)
  }
  const editDraft = (next) => {
    setDraft(next)
    if (saveStatus !== 'saving') setSaveStatus('idle')
  }
  const saveDraft = async (blocks) => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: source.id, blocks })
      })
      if (!res.ok) throw new Error((await res.json()).error || res.statusText)
      setSaveError('')
      setSaveStatus('saved')
    } catch (error) {
      console.error('Composition was not saved', error)
      setSaveError(error.message)
      setSaveStatus('error')
    }
  }
  // Autosave, throttled: the first change of a burst starts a one-second wait,
  // and when it ends the latest draft is written.
  const draftRef = useRef(null)
  draftRef.current = draft
  const saveTimer = useRef(null)
  useEffect(() => {
    if (!composing || !dirty || saveTimer.current) return
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      saveDraft(draftRef.current)
    }, 1000)
  })
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  // A card and its block on the sheet find each other.
  const showBlock = (index) => {
    setFocusedBlock(index)
    if (spread) {
      const page = layout?.blockPages[index]
      if (page !== undefined) {
        setSlide(null)
        setOpening(Math.floor(page / 2))
      }
      return
    }
    const el = sheetRef.current && sheetRef.current.querySelector(`[data-block="${index}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    sheetRef.current.querySelectorAll('.src-composing-on').forEach((x) => x.classList.remove('src-composing-on'))
    el.classList.add('src-composing-on')
  }
  useEffect(() => {
    const area = pageRef.current
    if (!area) return
    area.querySelectorAll('.src-composing-on').forEach((el) => el.classList.remove('src-composing-on'))
    if (composing && focusedBlock !== null) {
      area.querySelectorAll(`[data-block="${focusedBlock}"]`).forEach((el) => el.classList.add('src-composing-on'))
    }
  }, [composing, focusedBlock, layout, opening, spread])
  const findCard = (e) => {
    const el = composing && e.target.closest && e.target.closest('[data-block]')
    const area = el && document.getElementById(`compose-${el.dataset.block}`)
    if (area) {
      area.focus()
      area.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  // The sheet's tools: the PDF and the two-page view. They sit at the
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
    </div>
  )

  // Composition floats in the window's corner, in reach wherever the sheet is
  // scrolled to — on a local checkout only.
  const composeButton = CAN_COMPOSE && (
    <button
      type="button"
      className={`src-tool src-compose-float${composing ? ' on' : ''}`}
      onClick={() => (composing ? closeComposer() : openComposer())}
      aria-pressed={composing}
      title="קומפוזיציה — עריכת הטקסט ועימוד הפסקאות"
      aria-label="קומפוזיציה"
    >
      <IconCompose />
    </button>
  )

  return (
    <>
      <Head>
        <title>ס.פ.ר — מקורות</title>
        <meta name="description" content="מקורות על הלשון, האותיות והמספר" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={`src-root${spread ? ' src-root-spread' : ''}${composing ? ' src-root-composing' : ''}`}>
        <AppNav current="library" />

        <div className="src-body">
          {composing && draft && (
            <Composer
              blocks={draft}
              onChange={editDraft}
              onFocusBlock={showBlock}
              status={saveStatus}
              error={saveError}
              dirty={dirty}
              onClose={closeComposer}
            />
          )}
          <nav className="src-list" aria-label="מקורות" hidden={composing}>
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

          {composeButton}
          <article className="src-page" ref={pageRef}>
            {spread && (
              <div className="src-spread">
                {/* The two controls the view keeps, floating in its corner: the
                    way back to the sheet, and the PDF of the pages shown. The
                    pages turn from the keyboard's arrows, or by a click on a
                    page — the left one leads on, the right one back, as in a
                    book. */}
                <div className="src-spread-tools">
                  <button
                    type="button"
                    className="src-tool on"
                    onClick={() => setSpread(false)}
                    aria-pressed="true"
                    title="חזרה לדף"
                    aria-label="עמודים"
                  >
                    <IconSpread />
                  </button>
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
                </div>
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
                              onSelectBlock={composing ? findCard : undefined}
                              turn={composing ? null : side === 0 ? (opening > 0 ? 'back' : null) : opening < openings - 1 ? 'on' : null}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
                {/* Every spread, in reach: a button for each, the first on the
                    right as in the book, the one shown pressed. */}
                {layout && openings > 1 && (
                  <nav className="src-spread-pager" aria-label="עמודים">
                    {Array.from({ length: openings }, (_, at) => {
                      const first = 2 * at + 1
                      const last = Math.min(2 * at + 2, layout.pages.length)
                      return (
                        <button
                          type="button"
                          key={at}
                          className={`src-spread-pager-item${at === opening ? ' on' : ''}`}
                          onClick={() => turn(at - opening)}
                          aria-current={at === opening ? 'page' : undefined}
                          title={`עמודים ${first}–${last}`}
                        >
                          {first === last ? first : `${first}–${last}`}
                        </button>
                      )
                    })}
                  </nav>
                )}
              </div>
            )}

            <ComposingContext.Provider value={composing}>
            <PickContext.Provider value={pick}>
              <div
                className="src-sheet"
                ref={sheetRef}
                style={spread ? { display: 'none' } : undefined}
                onMouseOver={pick ? undefined : showTip}
                onMouseLeave={() => setHoverTip(null)}
                onMouseUp={composing ? undefined : pickSelection}
                onClick={composing ? findCard : undefined}
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
                            style={{ background: `linear-gradient(${color}, ${color}) left bottom / 100% ${RULE}px no-repeat` }}
                          >
                            {value}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </header>

                <div className="src-text" style={{ '--src-leading': leading }}>
                  {/* Each block carries its place in the list, for the composition
                      panel to find it on the sheet and the sheet to find its card. */}
                  {sheetBlocks.map((block, index) => {
                    const el = Block({
                      index,
                      block,
                      gematria: analysis ? analysis.blocks : null,
                      laneCount: analysis ? analysis.laneCount : 0,
                      legend: analysis ? analysis.legend : null
                    })
                    return cloneElement(el, {
                      key: index,
                      'data-block': index,
                      'data-page-break-before': block.pageBreakBefore ? 'true' : undefined,
                      'data-space-before': block.spaceBefore,
                      style: { ...el.props.style, ...indented(block), ...spaced(block, sheetBlocks[index - 1]) }
                    })
                  })}
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
            </ComposingContext.Provider>
          </article>
        </div>
      </div>
    </>
  )
}
