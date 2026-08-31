import { useEffect, useMemo, useState } from 'react'
import {
  POLYGON_LETTERS,
  POLYGON_N,
  WORD_CENTER,
  WORD_LABEL_RADIUS,
  WORD_RADIUS,
  WORD_SVG_SIZE,
  allTemurotOf,
  applyRotation,
  applyReflection,
  applyTemurah,
  areaFraction,
  arrowSegment,
  axisAngle,
  listTseroufim,
  modulo,
  polygonArea,
  reflectionName,
  reflectionSegments,
  rotationMappings,
  rotationName,
  temurahMatches,
  vertexPoint,
  withFinalLetter,
  wordToIndices,
  wordVertex
} from '../utils/temurot'

/*
 * The alphabet as a polygon, and the תמורות as its symmetries.
 *
 * Above: the n-gon itself, turned by Cₖ or folded about Rₖ, with the mapping of
 * letters that the turn or the fold amounts to written out beside it.
 *
 * Below: a word drawn on the 22-gon — the closed path through its letters — its
 * 22 rotations and 22 reflections, the shape's area against the widest one the
 * same letters can draw, and every צירוף of those letters gathered by shape.
 * A word that is also a word of the תנ״ך is written in green.
 */

const SVG_SIZE = 720
const CENTER = SVG_SIZE / 2
const RADIUS = 270
const LABEL_RADIUS = 310

const MIN_N = 3

// The concordance is asked in batches: a long word has thousands of צירופים,
// each with 44 תמורות, and the whole list would not fit in one request.
const LOOKUP_BATCH = 4000

const AREA_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })
const RATIO_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const COUNT_FORMAT = new Intl.NumberFormat('en-US')

const formatArea = (area) => AREA_FORMAT.format(areaFraction(area))
const formatRatio = (ratio) => (ratio === undefined ? '—' : RATIO_FORMAT.format(ratio))
const formatCount = (count) =>
  count <= BigInt(Number.MAX_SAFE_INTEGER) ? COUNT_FORMAT.format(Number(count)) : count.toString()

const icon = (children) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const RotateBackIcon = () =>
  icon(
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  )

const RotateForwardIcon = () =>
  icon(
    <>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </>
  )

const ChevronBackIcon = () => icon(<polyline points="15 18 9 12 15 6" />)
const ChevronForwardIcon = () => icon(<polyline points="9 18 15 12 9 6" />)

// One column of the mapping a תמורה amounts to: every letter beside the letter
// it becomes.
function SegmentCard({ arrow, letters, targets }) {
  const mapped = targets || [...letters].reverse()

  return (
    <div className="tp-segment">
      {letters.map((letter, index) => (
        <div className="tp-segment-row" key={`${letter}-${index}`}>
          <span className="tp-segment-letter">{letter}</span>
          <span className="tp-segment-arrow">{arrow}</span>
          <span className="tp-segment-letter">{mapped[index]}</span>
        </div>
      ))}
    </div>
  )
}

// The 22 words one family of תמורות makes out of the word, each a button that
// applies it.
function TemurotList({ title, entries, inTanakh, onSelect }) {
  return (
    <section className="tp-list">
      <h3 className="tp-list-title">{title}</h3>
      <ol className="tp-list-items">
        {entries.map((entry) => {
          const word = withFinalLetter(entry.word)
          return (
            <li key={entry.label}>
              <button
                type="button"
                className={`tp-list-item${entry.active ? ' active' : ''}`}
                aria-pressed={entry.active}
                aria-label={`תמורה ${entry.label}`}
                onClick={() => onSelect(entry)}
              >
                <span className="tp-list-label">{entry.label}</span>
                <span className={`tp-list-word${inTanakh(word) ? ' in-tanakh' : ''}`} dir="rtl">
                  {word}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// All the צירופים that draw one shape, with the fraction of the convex area
// that shape covers. Beside each word, how many of its 44 תמורות are words of
// the תנ״ך.
function OrbitCard({ orbit, inTanakh, selectedWord, onSelectWord }) {
  return (
    <li className="tp-orbit">
      <div className="tp-orbit-head">
        <span className="tp-orbit-size">{COUNT_FORMAT.format(orbit.entries.length)}</span>
        <span className="tp-orbit-ratio">{formatRatio(orbit.ratio)}</span>
      </div>
      <div className="tp-orbit-words">
        {orbit.entries.map((entry, index) => {
          const word = withFinalLetter(entry.word)
          const found = new Set(allTemurotOf(entry.word).filter(inTanakh)).size
          const selected = entry.word === selectedWord

          return (
            <button
              type="button"
              key={`${entry.word}-${index}`}
              dir="rtl"
              className={`tp-orbit-word${selected ? ' selected' : ''}${found > 0 ? ' in-tanakh' : ''}`}
              aria-current={selected ? 'true' : undefined}
              aria-label={`צירוף ${word}`}
              onClick={() => onSelectWord(entry.word)}
            >
              <span className="tp-orbit-word-text">{word}</span>
              <span className="tp-orbit-word-count">{found}</span>
            </button>
          )
        })}
      </div>
    </li>
  )
}

function Stat({ label, value }) {
  return (
    <div className="tp-stat">
      <dt className="tp-stat-label">{label}</dt>
      <dd className="tp-stat-value">{value}</dd>
    </div>
  )
}

/*
 * `value` is { n, axis, rotation, word, temurah, convex }, held by the page so
 * that the screen can be linked to; `temurah` is null, or { kind, value } with
 * kind 'rotation' or 'reflection'.
 */
export default function TemurotPolygon({ value, onChange, inputRef }) {
  const { n, axis, rotation, word, temurah, convex } = value
  const [invert, setInvert] = useState(false)
  const [tanakhWords, setTanakhWords] = useState(() => new Set())

  const inTanakh = (candidate) => tanakhWords.has(candidate)

  // ---- the alphabet polygon -------------------------------------------------

  const labels = useMemo(() => POLYGON_LETTERS.slice(0, n), [n])
  const vertices = useMemo(
    () => labels.map((label, index) => ({ ...vertexPoint(index, n, RADIUS, CENTER), label })),
    [labels, n]
  )

  // The polygon shows whichever תמורה is chosen; with none chosen it shows the
  // one the controls beneath it are set to.
  const shownKind = temurah?.kind || (rotation === 0 ? 'reflection' : 'rotation')
  const shownAxis = temurah?.kind === 'reflection' ? temurah.value : axis
  const shownRotation = temurah?.kind === 'rotation' ? temurah.value : rotation

  const shownAngle = axisAngle(shownAxis, n)
  const axisStart = {
    x: CENTER - LABEL_RADIUS * Math.cos(shownAngle),
    y: CENTER - LABEL_RADIUS * Math.sin(shownAngle)
  }
  const axisEnd = {
    x: CENTER + LABEL_RADIUS * Math.cos(shownAngle),
    y: CENTER + LABEL_RADIUS * Math.sin(shownAngle)
  }

  const segments = useMemo(() => reflectionSegments(labels, shownAxis), [labels, shownAxis])
  const rotationRows = useMemo(
    () => rotationMappings(labels, shownRotation),
    [labels, shownRotation]
  )
  const shownName =
    shownKind === 'reflection' ? reflectionName(shownAxis) : rotationName(shownRotation, n)

  const applyN = (raw) => {
    const trimmed = String(raw).trim()
    if (!/^\d+$/.test(trimmed)) return false
    const clamped = Math.min(POLYGON_N, Math.max(MIN_N, Number(trimmed)))
    onChange({
      n: clamped,
      axis: Math.min(axis, clamped - 1),
      rotation: Math.max(1 - clamped, Math.min(clamped - 1, rotation)),
      temurah: null
    })
    return true
  }

  // ---- the word on the 22-gon ----------------------------------------------

  const wordIndices = useMemo(() => wordToIndices(word), [word])
  const controlTemurah = useMemo(
    () =>
      rotation !== 0
        ? { kind: 'rotation', value: modulo(rotation, POLYGON_N) }
        : { kind: 'reflection', value: axis },
    [axis, rotation]
  )
  const temurahWord = useMemo(
    () => applyTemurah(word, temurah || controlTemurah),
    [controlTemurah, temurah, word]
  )

  // With a תמורה chosen it is the permuted word that is drawn; otherwise the
  // word as it was typed.
  const drawnIndices = useMemo(
    () => (temurah ? wordToIndices(temurahWord) : wordIndices),
    [temurah, temurahWord, wordIndices]
  )
  const pathIndices = useMemo(
    () => (convex ? [...drawnIndices].sort((a, b) => a - b) : drawnIndices),
    [convex, drawnIndices]
  )
  const litVertices = useMemo(() => new Set(drawnIndices), [drawnIndices])

  const wordArea = useMemo(() => polygonArea(drawnIndices), [drawnIndices])
  const convexArea = useMemo(
    () => polygonArea([...drawnIndices].sort((a, b) => a - b)),
    [drawnIndices]
  )
  const areaRatio = convexArea > 0 ? wordArea / convexArea : undefined
  const tseroufim = useMemo(() => listTseroufim(drawnIndices), [drawnIndices])

  const rotationEntries = useMemo(
    () =>
      Array.from({ length: POLYGON_N }, (_, k) => ({
        kind: 'rotation',
        label: rotationName(k, POLYGON_N),
        value: k,
        word: applyRotation(word, k),
        active: temurahMatches(temurah, 'rotation', k)
      })),
    [temurah, word]
  )
  const reflectionEntries = useMemo(
    () =>
      Array.from({ length: POLYGON_N }, (_, k) => ({
        kind: 'reflection',
        label: reflectionName(k),
        value: k,
        word: applyReflection(word, k),
        active: temurahMatches(temurah, 'reflection', k)
      })),
    [temurah, word]
  )

  // Every word the screen writes, asked of the תנ״ך at once: the 44 תמורות of
  // the word, and the 44 of every צירוף listed under it.
  const lookupWords = useMemo(() => {
    if (wordIndices.length === 0) return []
    const words = new Set(allTemurotOf(word).filter(Boolean))
    for (const orbit of tseroufim.orbits) {
      for (const entry of orbit.entries) {
        for (const candidate of allTemurotOf(entry.word)) words.add(candidate)
      }
    }
    return Array.from(words)
  }, [tseroufim, word, wordIndices])

  const lookupKey = lookupWords.join(' ')

  useEffect(() => {
    if (lookupWords.length === 0) {
      setTanakhWords(new Set())
      return undefined
    }

    let cancelled = false
    const batches = []
    for (let start = 0; start < lookupWords.length; start += LOOKUP_BATCH) {
      batches.push(lookupWords.slice(start, start + LOOKUP_BATCH))
    }

    Promise.all(
      batches.map((batch) =>
        fetch('/api/tanakh-words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words: batch })
        })
          .then((response) => (response.ok ? response.json() : { words: [] }))
          .then((data) => (Array.isArray(data.words) ? data.words : []))
          .catch(() => [])
      )
    ).then((found) => {
      if (!cancelled) setTanakhWords(new Set(found.flat()))
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey])

  const wordPath = useMemo(() => {
    if (pathIndices.length < 2) return ''
    return (
      pathIndices
        .map((index, i) => {
          const { x, y } = wordVertex(index)
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
        })
        .join(' ') + (pathIndices.length > 2 ? ' Z' : '')
    )
  }, [pathIndices])

  const drawnWord = temurah ? temurahWord : word

  // Only the black-and-white channel is inverted: the axis, the arrow and the
  // colour a תמורה is drawn in stay themselves.
  const structural = invert ? '#f8fafc' : '#4a4a4a'
  const vertexFill = invert ? '#000' : '#fff'

  return (
    <div className="tp">
      <div className="tp-top">
        <div className={`tp-card tp-polygon-card${invert ? ' inverted' : ''}`}>
          <svg
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="tp-polygon-svg"
            role="img"
            aria-label={`מצולע בן ${n} צלעות`}
          >
            <defs>
              <marker
                id="tp-rotation-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#e67e22" />
              </marker>
            </defs>

            {shownKind === 'reflection' && (
              <line
                x1={axisStart.x}
                y1={axisStart.y}
                x2={axisEnd.x}
                y2={axisEnd.y}
                stroke="#0891b2"
                strokeDasharray="8 7"
                strokeWidth={2}
                opacity={0.75}
              />
            )}

            <polygon
              points={vertices.map(({ x, y }) => `${x},${y}`).join(' ')}
              fill={invert ? 'rgba(248, 250, 252, 0.08)' : 'rgba(74, 74, 74, 0.05)'}
              stroke={structural}
              strokeLinejoin="round"
              strokeWidth={3}
            />

            {shownKind === 'rotation' &&
              shownRotation !== 0 &&
              (() => {
                const arrow = arrowSegment(vertices[0], vertices[modulo(shownRotation, n)])
                return (
                  <line
                    x1={arrow.x1}
                    y1={arrow.y1}
                    x2={arrow.x2}
                    y2={arrow.y2}
                    stroke="#e67e22"
                    strokeWidth={2.5}
                    opacity={0.85}
                    markerEnd="url(#tp-rotation-arrow)"
                  />
                )
              })()}

            {vertices.map(({ x, y, label }, index) => {
              const labelPoint = vertexPoint(index, n, LABEL_RADIUS, CENTER)
              return (
                <g key={`${index}-${label}`}>
                  <circle cx={x} cy={y} r={15} fill={vertexFill} stroke={structural} strokeWidth={2} />
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    fill={structural}
                    fontSize={26}
                    fontFamily="'David Libre', serif"
                    fontWeight={600}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="tp-controls">
            <label className="tp-control tp-n">
              <span>n =</span>
              <input
                key={`n-${n}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={String(n)}
                aria-label="מספר הצלעות"
                onBlur={(e) => {
                  if (!applyN(e.currentTarget.value)) e.currentTarget.value = String(n)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  else if (e.key === 'Escape') {
                    e.currentTarget.value = String(n)
                    e.currentTarget.blur()
                  }
                }}
              />
            </label>

            <div className="tp-control">
              <button
                type="button"
                className="tp-btn"
                title="סיבוב אחורה"
                aria-label="סיבוב אחורה"
                disabled={rotation <= 1 - n}
                onClick={() =>
                  onChange({ temurah: null, rotation: Math.max(1 - n, rotation - 1) })
                }
              >
                <RotateBackIcon />
              </button>
              <span className="tp-control-value">{rotationName(rotation, n)}</span>
              <button
                type="button"
                className="tp-btn"
                title="סיבוב קדימה"
                aria-label="סיבוב קדימה"
                disabled={rotation >= n - 1}
                onClick={() =>
                  onChange({ temurah: null, rotation: Math.min(n - 1, rotation + 1) })
                }
              >
                <RotateForwardIcon />
              </button>
            </div>

            <div className="tp-control">
              <button
                type="button"
                className="tp-btn"
                title="ציר השיקוף הקודם"
                aria-label="ציר השיקוף הקודם"
                onClick={() =>
                  onChange({ temurah: null, rotation: 0, axis: modulo(axis - 1, n) })
                }
              >
                <ChevronForwardIcon />
              </button>
              <span className="tp-control-value">{reflectionName(axis)}</span>
              <button
                type="button"
                className="tp-btn"
                title="ציר השיקוף הבא"
                aria-label="ציר השיקוף הבא"
                onClick={() =>
                  onChange({ temurah: null, rotation: 0, axis: modulo(axis + 1, n) })
                }
              >
                <ChevronBackIcon />
              </button>
            </div>

            <label className="tp-control tp-invert">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
              />
              <span>היפוך צבעים</span>
            </label>
          </div>
        </div>

        <aside className="tp-card tp-mapping">
          <div className="tp-mapping-head">
            <span>{shownKind === 'reflection' ? 'שיקוף' : 'סיבוב'}</span>
            <span className="tp-mapping-name">{shownName}</span>
          </div>
          <div className="tp-mapping-body">
            {shownKind === 'reflection' ? (
              segments
                .filter((segment) => segment.length > 0)
                .map((segment, index) => (
                  <SegmentCard key={index} arrow="↔" letters={segment} />
                ))
            ) : (
              <SegmentCard
                arrow="←"
                letters={rotationRows.map(([letter]) => letter)}
                targets={rotationRows.map(([, target]) => target)}
              />
            )}
          </div>
        </aside>
      </div>

      <div className="tp-card tp-word">
        <div className="tp-word-controls">
          <input
            ref={inputRef}
            dir="rtl"
            value={word}
            onChange={(e) => onChange({ word: e.target.value, temurah: null, convex: false })}
            placeholder="מילה"
            className="tp-word-input"
            aria-label="מילה למצולע"
          />
          <button
            type="button"
            className={`tp-toggle${temurah ? ' active' : ''}`}
            disabled={wordIndices.length === 0}
            onClick={() => onChange({ temurah: temurah ? null : controlTemurah })}
          >
            תמורה
          </button>
          <button
            type="button"
            className={`tp-toggle${convex ? ' active' : ''}`}
            disabled={drawnIndices.length < 2}
            onClick={() => onChange({ convex: !convex })}
          >
            קמור
          </button>
          {temurah && temurahWord && (
            <span className="tp-word-result" dir="rtl">
              {withFinalLetter(temurahWord)}
            </span>
          )}
        </div>

        <div className={`tp-word-body${word ? ' with-lists' : ''}`}>
          {word && (
            <TemurotList
              title="סיבובים"
              entries={rotationEntries}
              inTanakh={inTanakh}
              onSelect={(entry) =>
                onChange({
                  convex: false,
                  temurah: temurahMatches(temurah, entry.kind, entry.value)
                    ? null
                    : { kind: entry.kind, value: entry.value }
                })
              }
            />
          )}

          <div className="tp-word-figure">
            <svg
              viewBox={`0 0 ${WORD_SVG_SIZE} ${WORD_SVG_SIZE}`}
              className="tp-word-svg"
              role="img"
              aria-label="המילה על מצולע בן עשרים ושתים צלעות"
            >
              <defs>
                <marker
                  id="tp-word-rotation-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="#e67e22" />
                </marker>
              </defs>

              {(temurah || controlTemurah).kind === 'reflection' &&
                (() => {
                  const angle = axisAngle((temurah || controlTemurah).value, POLYGON_N)
                  return (
                    <line
                      x1={WORD_CENTER - WORD_LABEL_RADIUS * Math.cos(angle)}
                      y1={WORD_CENTER - WORD_LABEL_RADIUS * Math.sin(angle)}
                      x2={WORD_CENTER + WORD_LABEL_RADIUS * Math.cos(angle)}
                      y2={WORD_CENTER + WORD_LABEL_RADIUS * Math.sin(angle)}
                      stroke="#0891b2"
                      strokeDasharray="8 7"
                      strokeWidth={2}
                      opacity={0.75}
                    />
                  )
                })()}

              {temurah?.kind === 'rotation' &&
                temurah.value !== 0 &&
                wordIndices.length > 0 &&
                (() => {
                  const arrow = arrowSegment(
                    wordVertex(wordIndices[0]),
                    wordVertex(modulo(wordIndices[0] + temurah.value, POLYGON_N))
                  )
                  return (
                    <line
                      x1={arrow.x1}
                      y1={arrow.y1}
                      x2={arrow.x2}
                      y2={arrow.y2}
                      stroke="#e67e22"
                      strokeWidth={2.5}
                      opacity={0.85}
                      markerEnd="url(#tp-word-rotation-arrow)"
                    />
                  )
                })()}

              <polygon
                points={POLYGON_LETTERS.map((_, index) => {
                  const { x, y } = wordVertex(index)
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="#ddd"
                strokeWidth={1.5}
              />

              {wordPath && (
                <path
                  d={wordPath}
                  fill={temurah ? 'rgba(155, 89, 182, 0.12)' : 'rgba(74, 74, 74, 0.1)'}
                  stroke={temurah ? '#9b59b6' : '#4a4a4a'}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
              )}

              {POLYGON_LETTERS.map((letter, index) => {
                const { x, y } = wordVertex(index)
                const labelPoint = wordVertex(index, WORD_LABEL_RADIUS)
                const lit = litVertices.has(index)
                const color = temurah ? '#9b59b6' : '#4a4a4a'
                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={y}
                      r={11}
                      fill={lit ? color : '#fff'}
                      stroke={lit ? color : '#ddd'}
                      strokeWidth={1.5}
                    />
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      fill={lit ? color : '#999'}
                      fontSize={18}
                      fontFamily="'David Libre', serif"
                      fontWeight={lit ? 700 : 400}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {letter}
                    </text>
                  </g>
                )
              })}
            </svg>

            {drawnWord && drawnIndices.length > 0 && (
              <p className="tp-word-caption" dir="rtl">
                {withFinalLetter(drawnWord)}
              </p>
            )}
          </div>

          {word && (
            <TemurotList
              title="שיקופים"
              entries={reflectionEntries}
              inTanakh={inTanakh}
              onSelect={(entry) =>
                onChange({
                  convex: false,
                  temurah: temurahMatches(temurah, entry.kind, entry.value)
                    ? null
                    : { kind: entry.kind, value: entry.value }
                })
              }
            />
          )}
        </div>

        {drawnIndices.length > 0 && (
          <div className="tp-areas">
            <dl className="tp-stats">
              <Stat label="שטח המילה" value={formatArea(wordArea)} />
              <Stat label="שטח הקמור" value={formatArea(convexArea)} />
              <Stat label="היחס" value={formatRatio(areaRatio)} />
              <Stat label="צירופים" value={formatCount(tseroufim.totalPossible)} />
            </dl>

            {tseroufim.truncated ? (
              <p className="tp-orbits-note">
                {formatCount(tseroufim.totalPossible)} צירופים — יותר מכדי למנות את צורותיהם.
              </p>
            ) : (
              <ul className="tp-orbits">
                {tseroufim.orbits.map((orbit) => (
                  <OrbitCard
                    key={orbit.shapeKey}
                    orbit={orbit}
                    inTanakh={inTanakh}
                    selectedWord={word}
                    onSelectWord={(next) =>
                      onChange({ word: next, temurah: null, convex: false })
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
