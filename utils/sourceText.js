// A tiny inline markup for the מקורות texts, so a passage can be set the way a
// traditional printed page sets it:
//
//   {א״ה}   letters that the text is talking about   -> kind 'letter'
//   [כ״ב]   a number written with letters            -> kind 'num'
//   «...»   a verse quoted inside the commentary     -> kind 'verse'
//   (...)   a source reference                       -> kind 'ref' (detected, not marked)
//
// The markers are never displayed. Stripping them yields the plain text, which
// is what the gematria analysis works on — so a marked-up text and its plain
// form always tokenize the same way (markers hold no whitespace).

const OPENERS = { '{': 'letter', '[': 'num', '«': 'verse' }
const CLOSERS = { '}': 'letter', ']': 'num', '»': 'verse' }

// Marked text -> flat [{ text, kind }] segments (kind is null for plain text)
export function parseMarked(text) {
  const segments = []
  let kind = null
  let buffer = ''
  const flush = () => {
    if (buffer) segments.push({ text: buffer, kind })
    buffer = ''
  }
  for (const ch of text) {
    if (!kind && OPENERS[ch]) {
      flush()
      kind = OPENERS[ch]
      continue
    }
    if (kind && CLOSERS[ch] === kind) {
      flush()
      kind = null
      continue
    }
    buffer += ch
  }
  flush()
  return segments
}

export function stripMarkup(text) {
  return parseMarked(text).map((s) => s.text).join('')
}

// Ibn Ezra cites his sources in parentheses on nearly every line; picking them
// out of the plain segments keeps the data file free of one more marker.
export function markReferences(segments) {
  const out = []
  segments.forEach((seg) => {
    if (seg.kind) {
      out.push(seg)
      return
    }
    seg.text.split(/(\([^()]*\))/).forEach((part) => {
      if (!part) return
      out.push({ text: part, kind: part.startsWith('(') ? 'ref' : null })
    })
  })
  return out
}

// Marked text -> tokens that line up one-to-one with the tokens the gematria
// analysis builds from the plain text (it splits on /(\s+)/, so whitespace runs
// are one token and words are one token, each carrying its own marked pieces).
export function tokenizeMarked(text) {
  const tokens = []
  let current = null
  const push = (piece, isSpace) => {
    if (!current || current.isSpace !== isSpace) {
      current = { isSpace, pieces: [], plain: '' }
      tokens.push(current)
    }
    current.pieces.push(piece)
    current.plain += piece.text
  }
  parseMarked(text).forEach(({ text: segText, kind }) => {
    segText.split(/(\s+)/).forEach((part) => {
      if (part === '') return
      push({ text: part, kind }, /^\s+$/.test(part))
    })
  })
  return tokens
}
