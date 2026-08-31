/*
 * The alphabet laid out as a regular polygon: the 22 letters are the vertices
 * of a 22-gon, in order, א at the top. Read that way, a תמורה is a symmetry of
 * the polygon — a rotation Cₖ, which carries every letter k places along the
 * circle, or a reflection Rₖ about one of its axes, which folds the alphabet
 * back onto itself. א״ת ב״ש is the reflection about the axis between א and ת;
 * כוז״ו is the rotation by one place.
 *
 * A word becomes a closed path on the same circle, and the shape it draws is
 * what a תמורה moves and a צירוף rearranges.
 */

export const POLYGON_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'.split('')
export const POLYGON_N = POLYGON_LETTERS.length

const FINAL_TO_REGULAR = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }
const REGULAR_TO_FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' }

// The geometry of the drawing: a circle of vertices, and a wider circle the
// letters are written on.
export const WORD_SVG_SIZE = 500
export const WORD_CENTER = WORD_SVG_SIZE / 2
export const WORD_RADIUS = 205
export const WORD_LABEL_RADIUS = 238

// Areas are given as a fraction of the whole 22-gon, so that they mean the same
// thing whatever the drawing is scaled to.
const FULL_POLYGON_AREA = (POLYGON_N / 2) * WORD_RADIUS ** 2 * Math.sin((2 * Math.PI) / POLYGON_N)

// Beyond 8! arrangements the list of צירופים is no longer something to look at,
// and counting their shapes would take longer than anyone would wait.
const MAX_TSEROUF_PERMUTATIONS = 40320

export const modulo = (value, modulus) => ((value % modulus) + modulus) % modulus

export const normalizeLetter = (letter) => FINAL_TO_REGULAR[letter] || letter

// A word is written with its last letter in its final form, as it is written in
// a book — the permutation itself knows nothing of final forms.
export function withFinalLetter(word) {
  if (!word) return word
  const letters = word.split('')
  const last = letters.length - 1
  letters[last] = REGULAR_TO_FINAL[normalizeLetter(letters[last])] || letters[last]
  return letters.join('')
}

// The places of a word on the circle. Anything that is not a Hebrew letter —
// a space, a mark, a digit — has no place there and is dropped.
export function wordToIndices(word) {
  return word
    .split('')
    .map((char) => POLYGON_LETTERS.indexOf(normalizeLetter(char)))
    .filter((index) => index !== -1)
}

export const indicesToWord = (indices) => indices.map((index) => POLYGON_LETTERS[index]).join('')

// Vertex `index` of an n-gon, drawn on a circle of the given radius with the
// first vertex at the top and the rest running clockwise.
export function vertexPoint(index, n, radius, center) {
  const angle = (2 * Math.PI * index) / n - Math.PI / 2
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle)
  }
}

export const wordVertex = (index, radius = WORD_RADIUS) =>
  vertexPoint(index, POLYGON_N, radius, WORD_CENTER)

// The axis of reflection Rₐ, as an angle: it passes between two neighbouring
// vertices, so it advances by half a step at a time.
export const axisAngle = (axis, n) => -Math.PI / 2 + (Math.PI * axis) / n

// Where vertex `index` lands when the polygon is folded about axis `axis`.
export function mirrorIndex(index, axis, n) {
  const start = -Math.PI / 2
  const step = (2 * Math.PI) / n
  const reflected = 2 * axisAngle(axis, n) - (start + index * step)
  return modulo(Math.round((reflected - start) / step), n)
}

// The shoelace area of the closed path a word draws. A path that crosses itself
// counts the parts it encloses with the sign of the way it goes round them,
// which is what makes one צירוף narrower than another.
export function polygonArea(indices) {
  if (indices.length < 3) return 0

  let sum = 0
  for (let i = 0; i < indices.length; i++) {
    const current = wordVertex(indices[i])
    const next = wordVertex(indices[(i + 1) % indices.length])
    sum += current.x * next.y - next.x * current.y
  }

  return Math.abs(sum) / 2
}

export const areaFraction = (area) => area / FULL_POLYGON_AREA

// The letter mappings of a תמורה, as functions on a word.
const mapWord = (word, mapIndex) =>
  word
    .split('')
    .map((char) => {
      const index = POLYGON_LETTERS.indexOf(normalizeLetter(char))
      return index === -1 ? char : POLYGON_LETTERS[mapIndex(index)]
    })
    .join('')

export const applyRotation = (word, rotation) =>
  mapWord(word, (index) => modulo(index + rotation, POLYGON_N))

export const applyReflection = (word, axis) =>
  mapWord(word, (index) => modulo(axis - index, POLYGON_N))

export const applyTemurah = (word, temurah) =>
  temurah.kind === 'rotation'
    ? applyRotation(word, temurah.value)
    : applyReflection(word, temurah.value)

// The names the two families go by: C for the rotations, R for the reflections.
export const rotationName = (rotation, n) => `C${modulo(rotation, n)}`
export const reflectionName = (axis) => `R${axis + 1}`

export const temurahMatches = (selected, kind, value) =>
  selected?.kind === kind && selected.value === value

// Every תמורה of a word — the 22 rotations and the 22 reflections — written as
// they would be in a book, for asking the תנ״ך about them all at once.
export const allTemurotOf = (word) => [
  ...Array.from({ length: POLYGON_N }, (_, k) => withFinalLetter(applyRotation(word, k))),
  ...Array.from({ length: POLYGON_N }, (_, k) => withFinalLetter(applyReflection(word, k)))
]

// The rotation Cₖ maps each letter of the alphabet to the letter k places on;
// this is that mapping, read off the polygon as it is currently labelled.
export function rotationMappings(labels, rotation) {
  return labels.map((label, index) => [label, labels[modulo(index + rotation, labels.length)]])
}

// A reflection pairs the letters two by two, and the pairing splits the
// alphabet in two runs: the letters up to the one א is folded onto, and the
// rest. Each run read against itself reversed is the whole תמורה — this is what
// the name א״ת ב״ש says.
export function reflectionSegments(labels, axis) {
  const n = labels.length
  const splitEnd = mirrorIndex(0, axis, n)
  return [labels.slice(0, splitEnd + 1), labels.slice(splitEnd + 1)]
}

const encodeShape = (indices) => indices.map((i) => String(i).padStart(2, '0')).join('.')

/*
 * Two צירופים draw the same shape when one drawing can be turned or folded onto
 * the other — that is, when a תמורה carries one word to the other, possibly
 * read backwards or starting from another letter. The key below is the smallest
 * of all those readings, so words that draw one shape share one key.
 */
export function shapeKey(indices) {
  if (indices.length === 0) return ''

  let best

  for (let start = 0; start < indices.length; start++) {
    const forward = Array.from(
      { length: indices.length },
      (_, offset) => indices[(start + offset) % indices.length]
    )
    const backward = Array.from(
      { length: indices.length },
      (_, offset) => indices[(start - offset + indices.length) % indices.length]
    )

    for (const ordered of [forward, backward]) {
      for (let axis = 0; axis < POLYGON_N; axis++) {
        const rotated = ordered.map((index) => modulo(index + axis, POLYGON_N))
        const reflected = ordered.map((index) => modulo(axis - index, POLYGON_N))

        for (const candidate of [encodeShape(rotated), encodeShape(reflected)]) {
          if (best === undefined || candidate < best) best = candidate
        }
      }
    }
  }

  return best ?? ''
}

const factorial = (value) => {
  let result = BigInt(1)
  for (let i = 2; i <= value; i++) result *= BigInt(i)
  return result
}

// How many different words the letters make, a repeated letter counted once.
export function uniquePermutationCount(indices) {
  const counts = new Map()
  for (const index of indices) counts.set(index, (counts.get(index) || 0) + 1)

  let result = factorial(indices.length)
  for (const count of counts.values()) result /= factorial(count)
  return result
}

/*
 * Every צירוף of the letters of a word, grouped by the shape it draws and the
 * groups ordered from the widest shape down to the narrowest.
 */
export function listTseroufim(indices) {
  const totalPossible = uniquePermutationCount(indices)

  if (totalPossible > BigInt(MAX_TSEROUF_PERMUTATIONS)) {
    return { totalPossible, orbits: [], truncated: true }
  }

  const counts = Array.from(
    indices.reduce((map, index) => map.set(index, (map.get(index) || 0) + 1), new Map())
  ).sort(([a], [b]) => a - b)
  const permutation = new Array(indices.length)
  const convexArea = polygonArea([...indices].sort((a, b) => a - b))
  const entries = []

  const visit = (position) => {
    if (position === permutation.length) {
      const area = polygonArea(permutation)
      entries.push({
        word: indicesToWord(permutation),
        ratio: convexArea > 0 ? area / convexArea : undefined,
        shapeKey: shapeKey(permutation)
      })
      return
    }

    for (const entry of counts) {
      const [index, count] = entry
      if (count === 0) continue

      entry[1] = count - 1
      permutation[position] = index
      visit(position + 1)
      entry[1] = count
    }
  }

  visit(0)

  const orbitsByShape = new Map()
  for (const entry of entries) {
    const orbit = orbitsByShape.get(entry.shapeKey)
    if (orbit) orbit.entries.push(entry)
    else orbitsByShape.set(entry.shapeKey, { shapeKey: entry.shapeKey, ratio: entry.ratio, entries: [entry] })
  }

  const orbits = Array.from(orbitsByShape.values()).sort(
    (a, b) => (b.ratio ?? -Infinity) - (a.ratio ?? -Infinity)
  )

  return { totalPossible, orbits, truncated: false }
}

// The segment of the line from one vertex to another, held back at both ends so
// that the arrow does not run into the circles it joins.
export function arrowSegment(source, target, padding = 24) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.hypot(dx, dy)

  if (length === 0) return { x1: source.x, y1: source.y, x2: target.x, y2: target.y }

  const ux = dx / length
  const uy = dy / length

  return {
    x1: source.x + padding * ux,
    y1: source.y + padding * uy,
    x2: target.x - padding * ux,
    y2: target.y - padding * uy
  }
}
