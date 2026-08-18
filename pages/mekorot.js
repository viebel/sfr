import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { sources } from '../data/sources'
import { markReferences, parseMarked, tokenizeMarked } from '../utils/sourceText'
import { analyzeStory, buildLegend } from '../utils/storyAnalysis'
import { calculateGematria } from '../utils/gematria'

// --- the four hands of the page -------------------------------------------
// Plain text, a verse, a letter the text is talking about, a number written
// with letters — each is set differently, the way a printed page sets them.

// Gershayim and geresh mark a word as letters or as a number; here the setting
// says it, so the marks come off — א״ה is set אה, כ״ב is set כב.
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
  if (kind === 'verse') return <span className="src-verse-inline">{text}</span>
  if (kind === 'ref') return <span className="src-ref">{text}</span>
  return <>{text}</>
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
function MarkedWithGematria({ text, block, laneCount }) {
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
    const seen = new Set()
    const title = cover
      .filter((m) => (seen.has(m.key) ? false : seen.add(m.key)))
      .map((m) => `${m.value} · ${m.phrase}`)
      .join('\n')
    return (
      <span
        key={i}
        className="src-token"
        title={title}
        style={{ background: layers.join(', '), paddingBottom: `${bottomPad}px` }}
      >
        <Pieces pieces={pieces} />
      </span>
    )
  })
}

function Block({ block, gematria, laneCount, index }) {
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

  const body =
    gematria
      ? <MarkedWithGematria text={block.text} block={gematria[index]} laneCount={laneCount} />
      : <Marked text={block.text} />

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

  // Every block is analyzed on its own: a match can never cross a line break, so
  // block by block gives exactly the matches the whole text gives.
  const analysis = useMemo(() => {
    if (!source.numbers || source.numbers.length === 0) return null
    const legend = buildLegend(source.numbers)
    const blocks = source.blocks.map((block) => {
      if (block.type === 'verses') return null
      const tokens = tokenizeMarked(block.text)
      return analyzeStory(tokens.map((t) => t.plain).join(''), legend, [], false)
    })
    const counts = new Map()
    blocks.forEach((b) => b && b.counts.forEach((n, value) => counts.set(value, (counts.get(value) || 0) + n)))
    const laneCount = blocks.reduce((max, b) => Math.max(max, b ? b.laneCount : 0), 0)
    return { legend, blocks, counts, laneCount }
  }, [source])

  const lineHeight = analysis ? Math.max(1.95, 1.5 + analysis.laneCount * 0.32) : undefined

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
              <Link href="/rtl" className="src-subtab">קורא</Link>
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
            <div className="src-sheet">
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
                  <div className="src-legend">
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
                  />
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  )
}
