import Head from 'next/head'
import Link from 'next/link'
import { Fragment } from 'react'
import AppNav from '../components/AppNav'

/*
 * The graphic charter of the מקורות pages, as the site shows it. The text is
 * docs/mekorot-charter.md itself, read when the page is built: the file in the
 * repository stays the one place the charter is written, and this page cannot
 * drift from it. It is set on the sheet it describes, and every colour it names
 * is shown beside its value.
 */
export async function getStaticProps() {
  const { readFile } = await import('fs/promises')
  const path = await import('path')
  const markdown = await readFile(path.join(process.cwd(), 'docs', 'mekorot-charter.md'), 'utf8')
  return { props: { blocks: parseMarkdown(markdown) } }
}

// --- the few shapes of markdown the charter is written in ----------------------
// Headings, paragraphs, lists (bulleted, numbered, checklists) and tables.

function parseMarkdown(markdown) {
  const blocks = []
  const lines = markdown.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      i++
    } else if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s|:-]+\|$/.test(lines[i].trim())) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
        }
        i++
      }
      blocks.push({ type: 'table', head: rows[0], rows: rows.slice(1) })
    } else if (/^(-|\d+\.)\s/.test(line)) {
      const ordered = /^\d+\./.test(line)
      const items = []
      while (i < lines.length && /^(-|\d+\.)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^(-|\d+\.)\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', ordered, items })
    } else {
      const text = []
      while (i < lines.length && lines[i].trim() && !/^(#|\||-\s|\d+\.\s)/.test(lines[i])) {
        text.push(lines[i].trim())
        i++
      }
      blocks.push({ type: 'para', text: text.join(' ') })
    }
  }
  return blocks
}

// `code` is a value or a name; a colour or a --src- token gets its swatch.
function Code({ text }) {
  const colour = /^#[0-9a-f]{3,8}$/i.test(text) ? text : /^--src-(?!lift|float|leading)[a-z-]+$/.test(text) ? `var(${text})` : null
  return (
    <code className="charter-code">
      {colour && <span className="charter-swatch" style={{ background: colour }} aria-hidden="true" />}
      {text}
    </code>
  )
}

// The charter is English with Hebrew in it: each Hebrew run is isolated, so the
// punctuation around it keeps the direction of the English sentence.
const HEBREW = /([֐-׿](?:[֐-׿\s'"·]*[֐-׿])?)/

function Plain({ text }) {
  return text.split(HEBREW).map((part, i) => (i % 2 ? <bdi key={i}>{part}</bdi> : <Fragment key={i}>{part}</Fragment>))
}

function Inline({ text }) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) return <Code key={i} text={part.slice(1, -1)} />
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}><Inline text={part.slice(2, -2)} /></strong>
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={i}><Inline text={part.slice(1, -1)} /></em>
    return <Plain key={i} text={part} />
  })
}

function Block({ block }) {
  if (block.type === 'heading') {
    const Tag = `h${block.level}`
    return <Tag className={`charter-h${block.level}`}><Inline text={block.text} /></Tag>
  }
  if (block.type === 'table') {
    return (
      <div className="charter-table-wrap">
        <table className="charter-table">
          <thead>
            <tr>{block.head.map((cell, i) => <th key={i}><Inline text={cell} /></th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>{row.map((cell, c) => <td key={c}><Inline text={cell} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul'
    return (
      <List className="charter-list">
        {block.items.map((item, i) => {
          const check = item.match(/^\[( |x)\]\s+(.*)$/)
          return (
            <li key={i} className={check ? 'charter-check' : undefined}>
              <Inline text={check ? check[2] : item} />
            </li>
          )
        })}
      </List>
    )
  }
  return <p className="charter-para"><Inline text={block.text} /></p>
}

export default function Charte({ blocks }) {
  return (
    <>
      <Head>
        <title>ס.פ.ר — charte graphique des מקורות</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="src-root">
        <AppNav current="library" />
        <div className="src-body">
          <article className="src-page">
            <div className="src-sheet charter" dir="ltr" lang="en">
              <Link href="/mekorot" className="charter-back">← מקורות</Link>
              {blocks.map((block, i) => <Block key={i} block={block} />)}
            </div>
          </article>
        </div>
      </div>
    </>
  )
}
