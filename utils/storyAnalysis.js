import { calculateGematria } from './gematria'

// Distinct, readable colors assigned to each chosen number
export const storyColors = [
  '#e6194B', // red
  '#3cb44b', // green
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#008080', // teal
  '#f032e6', // magenta
  '#9A6324', // brown
  '#808000', // olive
  '#42d4f4'  // cyan
]

// Map each valid, distinct chosen number to a color (first occurrence wins)
export function buildLegend(numbers) {
  const map = new Map()
  numbers.forEach((raw) => {
    const value = parseInt(raw, 10)
    if (!Number.isNaN(value) && value > 0 && !map.has(value)) {
      map.set(value, storyColors[map.size % storyColors.length])
    }
  })
  return map
}

// Geresh and gershayim — and the ASCII apostrophe / quote an OCR puts in their
// place — mark Hebrew numerals and acronyms, and quotation marks only enclose a
// phrase. None of them separates two words, so none of them cuts a group.
const enclosingMarks = /['"׳״‘’“”«»]/g

// Two newlines in a row (a blank line) are the only whitespace that separates
// two paragraphs; one newline is a wrapped line inside a paragraph.
const isParagraphBreak = (part) => (part.match(/\n/g) || []).length > 1

// A bracket always ends a sequence, whatever the punctuation toggle says: what
// sits inside one is an aside — a reference, a gloss — not part of the sentence.
const brackets = /[()[\]{}\u2329\u232a\u3008\u3009]/

// Punctuation at a word's edge, split from the word: `lead` cuts the sequence
// before the word, `trail` after it. Exported because a highlight has to stop
// at the same place — a rule runs under the word, not under its comma.
export const edgePunctuation = (word) => ({
  lead: (word.match(/^\p{P}+/u) || [''])[0],
  trail: (word.match(/\p{P}+$/u) || [''])[0]
})

// Does this run of edge punctuation separate two words, or is it only a numeral
// mark / a quote that happens to sit there?
const separates = (run) => run.replace(enclosingMarks, '') !== ''

// Tokenize the text, find every word / successive-word sequence whose gematria
// matches one of the chosen numbers, and assign stacking lanes for overlaps.
export function analyzeStory(text, legend, invalidatedMatches = [], ignorePunctuation = false) {
  const tokens = []
  if (text) {
    let lineNo = 0
    text.split(/(\s+)/).forEach((part) => {
      if (part === '') return
      const isSpace = /^\s+$/.test(part)
      // The words are NEVER modified — the user's punctuation choice only affects
      // the calculation. `clean` is the term shown in the matches list (mid-word
      // signs dropped, edge punctuation trimmed). `cutBefore` / `cutAfter` drive
      // group cutting. Gematria already ignores non-Hebrew characters.
      let clean = part
      let display = part
      let cutBefore = false
      let cutAfter = false
      if (isSpace) {
        // A lone newline is the source's page width — a PDF or an OCR breaking the
        // line where the column ended — not a break in the text: it reads as one
        // space, so the lines are joined back into continuous text, on screen and
        // for grouping. A blank line is a real paragraph break, and stays one.
        display = isParagraphBreak(part) ? '\n\n' : ' '
      } else {
        const noMid = part.replace(/(?<=\p{L})[^\p{L}\p{M}\s]+(?=\p{L})/gu, '')
        const { lead, trail } = edgePunctuation(noMid)
        // A bracket cuts unconditionally; the rest only when the user has not
        // asked for punctuation to be ignored.
        cutBefore = brackets.test(lead) || (!ignorePunctuation && separates(lead))
        cutAfter = brackets.test(trail) || (!ignorePunctuation && separates(trail))
        clean = noMid.replace(/^\p{P}+|\p{P}+$/gu, '')
      }
      if (cutBefore) lineNo += 1
      tokens.push({ text: part, display, clean, isSpace, gematria: isSpace ? 0 : calculateGematria(part), line: lineNo })
      if (isSpace) { if (isParagraphBreak(part)) lineNo += 1 }
      else if (cutAfter) lineNo += 1
    })
  }

  // Positions (into tokens) of the actual words, their gematria values and lines
  const wordPositions = []
  tokens.forEach((tok, i) => { if (!tok.isSpace) wordPositions.push(i) })
  const wordValues = wordPositions.map((i) => tokens[i].gematria)
  const wordLines = wordPositions.map((i) => tokens[i].line)

  // Prefix sums so a span's total is computed in O(1)
  const prefix = [0]
  for (let k = 0; k < wordValues.length; k++) prefix.push(prefix[k] + wordValues[k])

  let maxTarget = 0
  legend.forEach((_color, value) => { if (value > maxTarget) maxTarget = value })

  const invalidatedSet = new Set(invalidatedMatches)

  const matches = []
  const occurrences = new Map()
  if (legend.size > 0) {
    for (let a = 0; a < wordValues.length; a++) {
      if (wordValues[a] === 0) continue // a span must start on a Hebrew word
      for (let b = a; b < wordValues.length; b++) {
        if (wordLines[b] !== wordLines[a]) break // a sequence cannot cross a line break
        const sum = prefix[b + 1] - prefix[a]
        if (sum > maxTarget) break // sums only grow as b grows
        if (wordValues[b] === 0) continue // and must end on a Hebrew word
        if (legend.has(sum)) {
          // Content-based key so an invalidation survives token shifts on edit
          const spanWords = []
          for (let t = wordPositions[a]; t <= wordPositions[b]; t++) {
            if (!tokens[t].isSpace) spanWords.push(tokens[t].clean)
          }
          const base = `${sum}|${spanWords.join(' ')}`
          const occ = occurrences.get(base) || 0
          occurrences.set(base, occ + 1)
          // Each occurrence masks on its own, so it needs its own key; the first
          // one keeps the bare form, which older shared links already carry.
          const key = occ === 0 ? base : `${base}#${occ}`
          matches.push({
            tokenStart: wordPositions[a],
            tokenEnd: wordPositions[b],
            value: sum,
            color: legend.get(sum),
            wordCount: b - a + 1,
            phrase: spanWords.join(' '),
            key,
            invalid: invalidatedSet.has(key)
          })
        }
      }
    }
  }

  // The text only ever draws valid matches; invalidated ones live in the list below
  const rendered = matches.filter((m) => !m.invalid)

  // Assign each rendered match to a lane (greedy interval partitioning) so
  // overlapping matches get stacked underlines instead of colliding.
  const sorted = [...rendered].sort(
    (m1, m2) => m1.tokenStart - m2.tokenStart || m1.tokenEnd - m2.tokenEnd
  )
  const laneEnds = []
  sorted.forEach((m) => {
    let lane = 0
    while (lane < laneEnds.length && laneEnds[lane] >= m.tokenStart) lane++
    m.lane = lane
    laneEnds[lane] = m.tokenEnd
  })
  const laneCount = laneEnds.length

  // For each token, which matches cover it (used to draw the underlines)
  const tokenCover = tokens.map(() => [])
  sorted.forEach((m) => {
    for (let t = m.tokenStart; t <= m.tokenEnd; t++) tokenCover[t].push(m)
  })

  // Per-number match counts for the legend — what the text actually shows, so a
  // match the user masked stops being counted.
  const counts = new Map()
  rendered.forEach((m) => counts.set(m.value, (counts.get(m.value) || 0) + 1))

  // One row per occurrence for the curation panel, in reading order: the same
  // phrase found twice in the text is two rows, each masked on its own.
  const matchList = matches.map((m) => ({
    key: m.key,
    value: m.value,
    color: m.color,
    phrase: m.phrase,
    invalid: m.invalid,
    tokenStart: m.tokenStart,
    tokenEnd: m.tokenEnd
  }))

  // Find every word / successive-word sequence whose gematria equals `target`
  // (used to reveal all sequences sharing a selected word's value).
  const findSpans = (target) => {
    const spans = []
    if (!target || target <= 0) return spans
    for (let a = 0; a < wordValues.length; a++) {
      if (wordValues[a] === 0) continue
      const lineA = wordLines[a]
      for (let b = a; b < wordValues.length; b++) {
        if (wordLines[b] !== lineA) break
        const sum = prefix[b + 1] - prefix[a]
        if (sum > target) break
        if (wordValues[b] === 0) continue
        if (sum === target) spans.push({ tokenStart: wordPositions[a], tokenEnd: wordPositions[b] })
      }
    }
    return spans
  }

  return { tokens, tokenCover, laneCount, matchCount: matches.length, counts, matchList, findSpans }
}
