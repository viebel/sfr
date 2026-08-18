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

// Tokenize the text, find every word / successive-word sequence whose gematria
// matches one of the chosen numbers, and assign stacking lanes for overlaps.
export function analyzeStory(text, legend, invalidatedMatches = [], ignorePunctuation = false) {
  const tokens = []
  if (text) {
    let lineNo = 0
    text.split(/(\s+)/).forEach((part) => {
      if (part === '') return
      const isSpace = /^\s+$/.test(part)
      // The displayed text is NEVER modified — the user's punctuation choice only
      // affects the calculation. `clean` is the term shown in the matches list
      // (mid-word signs dropped, edge punctuation trimmed). `hasEdgePunct` drives
      // group cutting. Gematria already ignores non-Hebrew characters.
      let clean = part
      let hasEdgePunct = false
      if (!isSpace) {
        const noMid = part.replace(/(?<=\p{L})[^\p{L}\p{M}\s]+(?=\p{L})/gu, '')
        hasEdgePunct = /\p{P}/u.test(noMid)
        clean = noMid.replace(/^\p{P}+|\p{P}+$/gu, '')
      }
      tokens.push({ text: part, display: part, clean, isSpace, gematria: isSpace ? 0 : calculateGematria(part), line: lineNo })
      if (isSpace) lineNo += (part.match(/\n/g) || []).length
      // When not ignoring punctuation, any (edge) punctuation cuts the group
      else if (!ignorePunctuation && hasEdgePunct) lineNo += 1
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
          const key = `${sum}|${spanWords.join(' ')}`
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

  // Per-number match counts for the legend
  const counts = new Map()
  matches.forEach((m) => counts.set(m.value, (counts.get(m.value) || 0) + 1))

  // Deduped list of distinct matches (by phrase+value) for the curation panel,
  // in reading order, each carrying how many times it occurs in the text.
  const matchListMap = new Map()
  matches.forEach((m) => {
    const existing = matchListMap.get(m.key)
    if (existing) {
      existing.count += 1
    } else {
      matchListMap.set(m.key, {
        key: m.key,
        value: m.value,
        color: m.color,
        phrase: m.phrase,
        invalid: m.invalid,
        count: 1,
        firstStart: m.tokenStart
      })
    }
  })
  const matchList = Array.from(matchListMap.values()).sort((a, b) => a.firstStart - b.firstStart)

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
