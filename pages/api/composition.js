import { writeFile } from 'fs/promises'
import path from 'path'
import { sources } from '../../data/sources'

/*
 * The composition tool of /mekorot saves a source's blocks here: they are
 * written to data/blocks/<id>.json, the file the source reads them from, and
 * the change is a diff to commit like any other.
 *
 * Only on a machine that runs the app from its repository (`yarn dev`): a
 * deployed app has no repository to write to.
 */

const TYPES = new Set(['para', 'list', 'line', 'row', 'grid', 'quote', 'label', 'head', 'intro', 'table', 'verses'])

// A block is what the page knows how to set — nothing else reaches the file.
// Returns what is wrong with a block, or null.
function problem(block) {
  if (!block || typeof block !== 'object') return 'not an object'
  if (!TYPES.has(block.type)) return `unknown type "${block.type}"`
  if (block.pageBreakBefore !== undefined && typeof block.pageBreakBefore !== 'boolean') {
    return 'pageBreakBefore is not a boolean'
  }
  if (block.indent !== undefined && !(Number.isInteger(block.indent) && block.indent >= 0 && block.indent <= 9)) {
    return `indent ${block.indent} is not a whole number from 0 to 9`
  }
  if (block.space !== undefined && !(Number.isInteger(block.space) && block.space >= 0 && block.space <= 8)) {
    return `space ${block.space} is not a whole number from 0 to 8`
  }
  if (block.spaceBefore !== undefined && !(Number.isSafeInteger(block.spaceBefore) && block.spaceBefore >= 0)) {
    return `spaceBefore ${block.spaceBefore} is not a non-negative whole number`
  }
  if (block.type === 'grid') return Array.isArray(block.cells) && block.cells.every((c) => typeof c === 'string') ? null : 'grid cells are not text'
  if (block.type === 'table') return Array.isArray(block.head) && Array.isArray(block.rows) ? null : 'table without head or rows'
  if (block.type === 'verses') return Array.isArray(block.verses) ? null : 'verses without verses'
  return typeof block.text === 'string' ? null : 'no text'
}

// The block type `indent` (a paragraph set in by a third) became the `indent`
// field of any block: a draft opened before that is saved in today's form.
const current = (block) =>
  block && block.type === 'indent' ? { ...block, type: 'para', indent: block.indent ?? 4 } : block

export default async function handler(req, res) {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Composition is saved from a local checkout only' })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).end()
    return
  }
  const { id } = req.body || {}
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks.map(current) : null
  if (!sources.some((s) => s.id === id)) {
    res.status(404).json({ error: `Unknown source: ${id}` })
    return
  }
  if (!blocks || blocks.length === 0) {
    res.status(400).json({ error: 'No blocks to save' })
    return
  }
  const wrong = blocks.map((block, i) => [i, problem(block)]).find(([, why]) => why)
  if (wrong) {
    res.status(400).json({ error: `Block ${wrong[0] + 1}: ${wrong[1]}` })
    return
  }
  const file = path.join(process.cwd(), 'data', 'blocks', `${id}.json`)
  await writeFile(file, `${JSON.stringify(blocks, null, 2)}\n`, 'utf8')
  res.status(200).json({ saved: `data/blocks/${id}.json`, blocks: blocks.length })
}
