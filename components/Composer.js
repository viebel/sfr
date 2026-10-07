/*
 * The composition panel of /mekorot: the blocks of the open source, one card
 * each, to change their text and their setting. It edits a draft the sheet is
 * drawn from as it changes, and every change is written to
 * data/blocks/<id>.json (pages/api/composition.js) a second at most after it —
 * from a local checkout only.
 *
 * A card holds the block's role (para, row, grid…) and its text in the markup
 * of utils/sourceText.js — {letters}, [numbers], «verses» — and the hand that
 * turns a block into two, two into one, moves or drops it. The panel never
 * changes a word on its own: it only does what the hand asks.
 */

export const TYPES = [
  { id: 'para', label: 'פסקה' },
  { id: 'row', label: 'שורה ממורכזת' },
  { id: 'line', label: 'שורת אותיות' },
  { id: 'grid', label: 'טבלת עמודות' },
  { id: 'quote', label: 'ציטוט' },
  { id: 'label', label: 'פתיח' },
  { id: 'head', label: 'כותרת' },
  { id: 'list', label: 'פריט ברשימה' },
  { id: 'intro', label: 'הערה' }
]
const FIXED = { table: 'טבלה', verses: 'פסוקים' }

// A grid's cells are edited as one line, a cell between two bars.
const textOf = (block) => (block.type === 'grid' ? block.cells.join(' | ') : block.text || '')
const cellsOf = (text) => text.split('|').map((c) => c.trim()).filter(Boolean)

// The same words in another role: a grid is a row of words, words make a grid.
function retype(block, type) {
  if (type === block.type) return block
  const { cells, text, ...rest } = block
  if (type === 'grid') return { ...rest, type, cells: cellsOf((text || '').split(/\s+/).join('|')) }
  if (block.type === 'grid') return { ...rest, type, text: cells.join(' ') }
  return { ...block, type }
}

const editable = (block) => !FIXED[block.type]

// The indent, in twelfths of the line, and how it reads: 4 is a third.
const MAX_INDENT = 9
const FRACTIONS = ['0', '1/12', '1/6', '1/4', '1/3', '5/12', '1/2', '7/12', '2/3', '3/4']
// The space after a block, in quarters of the paragraph space; unset is the
// block's own. The first − from unset starts from the usual space (4).
const MAX_SPACE = 8
const USUAL_SPACE = 4
const withSpace = (block, steps) => {
  const { space, ...rest } = block
  return steps === USUAL_SPACE && block.space === undefined ? rest : { ...rest, space: Math.max(0, Math.min(MAX_SPACE, steps)) }
}
const spaceLabel = (block) => (block.space === undefined ? 'רגיל' : `${block.space * 25}%`)

const withSpaceBefore = (block, steps) => ({ ...block, spaceBefore: Math.max(0, steps) })
const spaceBeforeLabel = (block) => (block.spaceBefore === undefined ? 'רגיל' : `${block.spaceBefore * 25}%`)

const withIndent = (block, steps) => {
  const { indent, ...rest } = block
  return steps > 0 ? { ...rest, indent: steps } : rest
}

const togglePageBreak = (block) => {
  const { pageBreakBefore, ...rest } = block
  return pageBreakBefore ? rest : { ...block, pageBreakBefore: true }
}

function Icon({ children }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}
const IconUp = () => <Icon><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
const IconDown = () => <Icon><path d="M12 5v14M6 13l6 6 6-6" /></Icon>
const IconSplit = () => <Icon><path d="M4 12h16M8 7l-4 5 4 5M16 7l4 5-4 5" /></Icon>
const IconMerge = () => <Icon><path d="M12 4v6M12 20v-6M7 9l5 5 5-5M4 12h16" /></Icon>
const IconAdd = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>
// The indent's arrows point the way the lines move. A Hebrew line starts on the
// right, so it is set in leftwards: the lines on the left, the arrow on the
// right — pointing left for more, back to the right for less.
const IconMore = () => <Icon><path d="M4 6h10M4 12h8M4 18h10M20 9l-3 3 3 3" /></Icon>
const IconLess = () => <Icon><path d="M4 6h10M4 12h8M4 18h10M17 9l3 3-3 3" /></Icon>
// The space after a block: two bars drawn together, or apart.
const IconTighter = () => <Icon><path d="M5 9h14M5 15h14M12 3v4M10 5l2 2 2-2M12 21v-4M10 19l2-2 2 2" /></Icon>
const IconLooser = () => <Icon><path d="M5 9h14M5 15h14M12 7V3M10 5l2-2 2 2M12 17v4M10 19l2 2 2-2" /></Icon>
const IconDrop = () => <Icon><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></Icon>
const IconPageBreak = () => <Icon><path d="M5 8V3h14v5M5 16v5h14v-5" /><path d="M3 12h3m3 0h3m3 0h3m3 0h1" /></Icon>

function Tool({ title, onClick, disabled, pressed, children }) {
  return (
    <button type="button" className={`src-tool src-compose-tool${pressed ? ' on' : ''}`} title={title} aria-label={title} aria-pressed={pressed}
      onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default function Composer({ blocks, onChange, onFocusBlock, status, error, dirty, onClose }) {
  const set = (index, block) => onChange(blocks.map((b, i) => (i === index ? block : b)))
  const move = (index, step) => {
    const to = index + step
    if (to < 0 || to >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[to]] = [next[to], next[index]]
    onChange(next)
    onFocusBlock(to)
  }
  // Two blocks where there was one, cut where the caret stands; no word is lost.
  // Only the one space that parted two words at the cut goes: every other
  // space, at the head of a line or anywhere, stays as it was typed.
  const split = (index) => {
    const area = document.getElementById(`compose-${index}`)
    const block = blocks[index]
    if (!area || block.type === 'grid') return
    const at = area.selectionStart
    const head = block.text.slice(0, at).replace(/ $/, '')
    const tail = block.text.slice(at).replace(/^ /, '')
    if (!head.trim() || !tail.trim()) return
    const { lemma, pageBreakBefore, spaceBefore, ...plain } = block
    onChange([...blocks.slice(0, index), { ...block, text: head }, { ...plain, text: tail }, ...blocks.slice(index + 1)])
  }
  // One block where there were two, the second's words after the first's.
  const merge = (index) => {
    const a = blocks[index]
    const b = blocks[index + 1]
    if (!b || b.pageBreakBefore || !editable(a) || !editable(b)) return
    const joined = a.type === 'grid'
      ? { ...a, cells: [...a.cells, ...(b.type === 'grid' ? b.cells : cellsOf(b.text.split(/\s+/).join('|')))] }
      : { ...a, text: [a.text, textOf(b)].filter((t) => t !== '').join(' ') }
    onChange([...blocks.slice(0, index), joined, ...blocks.slice(index + 2)])
  }
  const insert = (index) => {
    onChange([...blocks.slice(0, index + 1), { type: 'para', text: '' }, ...blocks.slice(index + 1)])
    onFocusBlock(index + 1)
  }
  const drop = (index) => {
    if (!window.confirm('למחוק את הבלוק הזה ואת המלים שבו?')) return
    onChange(blocks.filter((_, i) => i !== index))
  }

  return (
    <aside className="src-compose" aria-label="קומפוזיציה">
      <div className="src-compose-bar">
        <span className="src-compose-title">קומפוזיציה</span>
        {/* Every change is written on its own, a second at most after it */}
        <span className="src-compose-status" aria-live="polite">
          {status === 'saving' ? 'שומר…' : status === 'error' ? `השמירה נכשלה — ${error}` : dirty ? 'ישמר בעוד רגע…' : status === 'saved' ? 'נשמר' : 'שמירה אוטומטית'}
        </span>
        <button type="button" className="src-compose-button" onClick={onClose}>
          סגירה
        </button>
      </div>

      <ol className="src-compose-list">
        {blocks.map((block, index) => (
          <li className="src-compose-card" key={index} onFocusCapture={() => onFocusBlock(index)}>
            <div className="src-compose-head">
              <span className="src-compose-index">{index + 1}</span>
              {editable(block) ? (
                <select
                  className="src-compose-type"
                  value={block.type}
                  onChange={(e) => set(index, retype(block, e.target.value))}
                  aria-label="תפקיד הבלוק"
                >
                  {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              ) : (
                <span className="src-compose-fixed">{FIXED[block.type]}</span>
              )}
              <span className="src-compose-indent" title="הזחה, בחלקי שורה">
                <Tool title="פחות הזחה" onClick={() => set(index, withIndent(block, (block.indent || 0) - 1))}
                  disabled={!(block.indent > 0)}><IconLess /></Tool>
                <span className="src-compose-indent-value">{FRACTIONS[block.indent || 0]}</span>
                <Tool title="יותר הזחה" onClick={() => set(index, withIndent(block, (block.indent || 0) + 1))}
                  disabled={(block.indent || 0) >= MAX_INDENT}><IconMore /></Tool>
              </span>
              <span className="src-compose-indent" title="הרווח לפני הבלוק, גם בראש עמוד">
                <Tool title="פחות רווח לפני הבלוק" onClick={() => set(index, withSpaceBefore(block, (block.spaceBefore ?? USUAL_SPACE) - 1))}
                  disabled={block.spaceBefore === 0}><IconTighter /></Tool>
                <span className="src-compose-indent-value">{spaceBeforeLabel(block)}</span>
                <Tool title="יותר רווח לפני הבלוק" onClick={() => set(index, withSpaceBefore(block, (block.spaceBefore ?? USUAL_SPACE) + 1))}><IconLooser /></Tool>
              </span>
              <span className="src-compose-indent" title="הרווח אחרי הבלוק, ביחס לרווח בין פסקאות">
                <Tool title="פחות רווח אחרי הבלוק" onClick={() => set(index, withSpace(block, (block.space ?? USUAL_SPACE) - 1))}
                  disabled={block.space === 0}><IconTighter /></Tool>
                <span className="src-compose-indent-value">{spaceLabel(block)}</span>
                <Tool title="יותר רווח אחרי הבלוק" onClick={() => set(index, withSpace(block, (block.space ?? USUAL_SPACE) + 1))}
                  disabled={block.space === MAX_SPACE}><IconLooser /></Tool>
              </span>
              <span className="src-compose-tools">
                <Tool title="התחלת עמוד חדש לפני הבלוק" pressed={!!block.pageBreakBefore}
                  onClick={() => set(index, togglePageBreak(block))}><IconPageBreak /></Tool>
                <Tool title="למעלה" onClick={() => move(index, -1)} disabled={index === 0}><IconUp /></Tool>
                <Tool title="למטה" onClick={() => move(index, 1)} disabled={index === blocks.length - 1}><IconDown /></Tool>
                <Tool title="פיצול במקום הסמן" onClick={() => split(index)} disabled={!editable(block) || block.type === 'grid'}><IconSplit /></Tool>
                <Tool title="איחוד עם הבלוק הבא" onClick={() => merge(index)}
                  disabled={index === blocks.length - 1 || !editable(block) || !editable(blocks[index + 1]) || blocks[index + 1].pageBreakBefore}><IconMerge /></Tool>
                <Tool title="בלוק חדש אחריו" onClick={() => insert(index)}><IconAdd /></Tool>
                <Tool title="מחיקה" onClick={() => drop(index)}><IconDrop /></Tool>
              </span>
            </div>
            {block.lemma !== undefined && (
              <input
                className="src-compose-lemma"
                value={block.lemma}
                onChange={(e) => set(index, { ...block, lemma: e.target.value })}
                aria-label="דיבור המתחיל"
                dir="rtl"
              />
            )}
            {editable(block) ? (
              <textarea
                id={`compose-${index}`}
                className="src-compose-text"
                dir="rtl"
                value={textOf(block)}
                rows={Math.max(1, Math.ceil(textOf(block).length / 48))}
                onChange={(e) => set(index, block.type === 'grid'
                  ? { ...block, cells: e.target.value.split('|').map((c) => c.trim()) }
                  : { ...block, text: e.target.value })}
                aria-label={`טקסט הבלוק ${index + 1}`}
              />
            ) : (
              <p className="src-compose-note">{FIXED[block.type]} — נערכים בקובץ הנתונים</p>
            )}
          </li>
        ))}
      </ol>
    </aside>
  )
}
