import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { sources } from '../data/sources'
import { markReferences, parseMarked, tokenizeMarked } from '../utils/sourceText'
import { analyzeStory, buildLegend } from '../utils/storyAnalysis'
import { calculateGematria } from '../utils/gematria'
import { edgePunctuation } from '../utils/storyAnalysis'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// --- the four hands of the page -------------------------------------------
// Plain text, a verse, a letter the text is talking about, a number written
// with letters — each is set differently, the way a printed page sets them.

// Gershayim and geresh mark a word as letters, as a number, or as a term to be
// counted; here the setting says it, so the marks come off everywhere — א״ה is
// set אה, כ״ב is set כב, כת״ר תור״ה is set כתר תורה under its gematria rule.
const bare = (text) => text.replace(/['"׳״]/g, '')

function Piece({ text, kind }) {
  if (kind === 'letter') return <span className="src-letter">{bare(text)}</span>
  if (kind === 'num') {
    return (
      <span className="src-num" title={`${calculateGematria(text)}`}>
        {bare(text)}
      </span>
    )
  }
  if (kind === 'verse') return <span className="src-verse-inline">{bare(text)}</span>
  if (kind === 'ref') return <span className="src-ref">{bare(text)}</span>
  return <>{bare(text)}</>
}

function Pieces({ pieces }) {
  return pieces.map((piece, i) => <Piece key={i} {...piece} />)
}

// A block of running text, with the references picked out of the plain parts
function Marked({ text }) {
  const pieces = useMemo(() => markReferences(parseMarked(text)), [text])
  return <Pieces pieces={pieces} />
}

// The same text, drawn over the gematria the ספור tab finds in it: every word
// (or run of words) whose value is one of the chosen numbers gets its color's
// underline, stacked in lanes when several matches overlap.
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

function MarkedWithGematria({ text, block, blockIndex, laneCount }) {
  const tokens = useMemo(() => tokenizeMarked(text), [text])
  if (!block || block.tokens.length !== tokens.length) return <Marked text={text} />

  const bottomPad = laneCount * 5 + 3
  return tokens.map((token, i) => {
    const cover = block.tokenCover[i]
    const pieces = markReferences(token.pieces)
    if (!cover || cover.length === 0) return <Pieces key={i} pieces={pieces} />
    const layers = cover.map(
      (m) => `linear-gradient(${m.color}, ${m.color}) left 0 bottom ${m.lane * 5}px / 100% 3px no-repeat`
    )
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
          style={{ background: layers.join(', '), paddingBottom: `${bottomPad}px` }}
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
function TableCell({ value, legend }) {
  const color = legend && legend.get(Number(value))
  if (!color) return <>{value}</>
  return (
    <span
      className="src-table-num"
      style={{ background: `linear-gradient(${color}, ${color}) left bottom / 100% 3px no-repeat` }}
    >
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
                ? <th key={c} scope="row">{cell}</th>
                : <td key={c}><TableCell value={cell} legend={legend} /></td>))}
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
  if (block.type === 'quote') return <blockquote className="src-blockquote">{body}</blockquote>
  if (block.type === 'list') {
    return (
      <p className="src-item">
        <span className="src-bullet" aria-hidden="true">◆</span>
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

export default function Mekorot() {
  const [activeId, setActiveId] = useState(sources[0].id)
  const [hoverTip, setHoverTip] = useState(null)
  const sheetRef = useRef(null)
  const tipRef = useRef(null)
  const source = sources.find((s) => s.id === activeId) || sources[0]

  // Deep link: /mekorot?src=... — read straight from the URL, this is a static page
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('src')
    if (wanted && sources.some((s) => s.id === wanted)) setActiveId(wanted)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('src') === activeId) return
    params.set('src', activeId)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }, [activeId])

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
    const counts = new Map()
    blocks.forEach((b) => b && b.counts.forEach((n, value) => counts.set(value, (counts.get(value) || 0) + n)))
    const laneCount = blocks.reduce((max, b) => Math.max(max, b ? b.laneCount : 0), 0)
    return { legend, blocks, counts, laneCount }
  }, [source])

  const lineHeight = analysis ? Math.max(1.95, 1.5 + analysis.laneCount * 0.32) : undefined

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

  // Keep the card inside the sheet on both axes, flipping under the word when
  // there is no room above it.
  useIsomorphicLayoutEffect(() => {
    const tip = tipRef.current
    const sheet = sheetRef.current
    if (!tip || !sheet || !hoverTip) return
    const left = Math.max(6, Math.min(hoverTip.cx - tip.offsetWidth / 2, sheet.clientWidth - tip.offsetWidth - 6))
    let top = hoverTip.topY - tip.offsetHeight - 8
    if (top < 4) top = hoverTip.botY + 8
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
  }, [hoverTip])

  return (
    <>
      <Head>
        <title>ס.פ.ר — מקורות</title>
        <meta name="description" content="מקורות על הלשון, האותיות והמספר" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;700&family=Frank+Ruhl+Libre:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="src-root">
        <div className="pdfr-toolbar">
          <div className="pdfr-toolbar-group">
            <Link href="/" className="pdfr-btn" title="ס.פ.ר" aria-label="חזרה לס.פ.ר">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 11 12 3.5l8.5 7.5" />
                <path d="M5.8 9.9V20h12.4V9.9" />
              </svg>
            </Link>
            <nav className="src-subtabs">
              <Link href="/library" className="src-subtab">ספר</Link>
              <Link href="/mekorot" className="src-subtab active" aria-current="page">מקורות</Link>
            </nav>
          </div>
        </div>

        <div className="src-body">
          <nav className="src-list" aria-label="מקורות">
            {sources.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`src-list-item${item.id === source.id ? ' active' : ''}`}
                onClick={() => setActiveId(item.id)}
                aria-current={item.id === source.id ? 'true' : undefined}
              >
                <span className="src-list-title">{item.nav}</span>
                <span className="src-list-author">{item.author}</span>
                <span className="src-list-work">{item.work}</span>
              </button>
            ))}
          </nav>

          <article className="src-page">
            <div className="src-sheet" ref={sheetRef} onMouseOver={showTip} onMouseLeave={() => setHoverTip(null)}>
              <header className="src-header">
                <h1 className="src-title">{source.title}</h1>
                <div className="src-attrib">{source.author}</div>
                <div className="src-work">
                  {source.work}
                  {source.place ? <span className="src-place"> · {source.place}</span> : null}
                </div>
                <div className="src-ornament" aria-hidden="true">
                  <span className="src-rule" />
                  <span className="src-diamond">✦</span>
                  <span className="src-rule" />
                </div>
                {analysis && (
                  <div className="src-legend" style={{ '--legend-cols': legendCols }}>
                    {Array.from(analysis.legend.entries()).map(([value, color]) => (
                      <span className="src-legend-item" key={value}>
                        <span className="src-legend-swatch" style={{ background: color }} aria-hidden="true" />
                        <span className="src-legend-value">{value}</span>
                        <span className="src-legend-count">{analysis.counts.get(value) || 0}</span>
                      </span>
                    ))}
                  </div>
                )}
              </header>

              <div className="src-text" style={lineHeight ? { lineHeight } : undefined}>
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

              {hoverTip && (
                <div className="src-tip" ref={tipRef}>
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
          </article>
        </div>
      </div>
    </>
  )
}
