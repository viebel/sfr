# The מקורות sheet — graphic charter

How the pages of `/mekorot` look, and why: the tones, the type, the spacing, the gematria layer, the tools, and the PDF made from the sheet. Every `.src-*` rule of `styles/globals.css` follows it, and the site shows it at `/charte` (`pages/charte.js` reads this file when the page is built); a style change that does not fit it changes the charter first.

What a source is made of — blocks, inline marks, `numbers`, `hide` — is in `docs/mekorot-typesetting.md`. The app's own chrome (the menu, the ספריה) follows the `ui-design` skill; מקורות is the one screen set on paper of its own.

## Principles

1. **A printed page, not a screen.** A sheet of warm paper lying on a desk: two faces, centered display lines, justified text, a thin inner frame.
2. **Every mark means one thing.** Colour says what a piece of text *is* — a letter, a number, a verse, a reference. The gematria underline is the only highlight. Nothing decorative competes with them.
3. **Nothing moves.** A counted word, a selected word, a hovered word keep the size and place of the text around them. The rules and tints are painted under the words, never set into them.
4. **Readable first.** Running text at 22px; nothing muted fainter than 4.5:1 against its ground; a rule sits against the word it belongs to, not between two lines.
5. **Few tones, named once.** The palette below is closed. A colour that is not a token does not go on the page.
6. **The screen and the PDF are one sheet.** The PDF is drawn from the same markup under the same rules; a change to the sheet is a change to the file.

## Palette

Declared once, in `:root`, as `--src-*`. Contrast is measured on `--src-sheet`.

| token | value | what it is |
| --- | --- | --- |
| `--src-desk` | `#f1ece2` | the ground the sheet and the list of sources lie on; a control under the hand sinks into it |
| `--src-sheet` | `#fffdf8` | the page; a source card at rest; the hover card |
| `--src-panel` | `#faf5ea` | a surface set into the page — the verses, the tool at rest, a card that is open or under the hand |
| `--src-line` | `#e6dfd0` | the one line: the sheet's edge and frame, cards, table rules, panels, the separator under a note |
| `--src-line-strong` | `#cdc2ac` | a line that answers the hand (hover), the rule under a table's head, the hover card's edge, the PDF's frame |
| `--src-ink-strong` | `#000` | a source's name in the list, a figure the legend colours — black, as the text is — 20.9:1 |
| `--src-ink` | `#000` | the text, in black: heads, display lines, quotes, legend values — 20.9:1 |
| `--src-ink-soft` | `#6b6155` | everything muted: the list's author and book, notes, references, verse numbers, table heads — 6:1, and never fainter |
| `--src-gold` | `#c9a227` | ornament only: the lozenge of a list item, the marker of the open source |
| `--src-gold-soft` | `#d9c58a` | the open source card's edge |
| `--src-letter` | `#1c5b7a` | `{…}` a letter the text speaks about — 7.3:1 |
| `--src-number` | `#8a6a12` | `[…]` a number written with letters — 5:1 |
| `--src-verse` | `#7a3b12` | `«…»` a verse, the verses block, the lemma — 8.4:1 |
| `--src-lift` | `0 2px 16px rgba(70,55,25,.08)` | the sheet off the desk — the only shadow on the page… |
| `--src-float` | `0 8px 22px rgba(70,55,25,.16)` | …except the hover card's, which floats over the text |

Outside the palette, on purpose: the gematria colours (`storyColors` in `utils/storyAnalysis.js`, shared with the ספור tab, assigned in the order of `numbers`), and the grey tint of a selection (`rgba(150,150,150,.38)`, also the ספור tab's). The PDF's paper is the app's `--paper` white.

- **Gold is never text.** At 2.4:1 it cannot carry a word; it marks, it does not say.
- **Muted is one ink.** Hierarchy among secondary texts comes from size and face, not from a lighter grey.
- **A control's three states use tones already here:** `--src-panel` at rest, `--src-desk` under the hand, `--src-line` pressed.

## Type

Two faces carry the page — the contrast between them is the design:

- **Frank Ruhl Libre** — the running text, and everything set inside it.
- **David Libre** — every voice that is not running text: title, author, heads, display lines, quotes, verses, letters, numbers, lemma, the list's titles, the hover card's phrases, the PDF's running head and folio.
- The system sans (the body's) is kept for the figures of the chrome: the legend, the hover card's values.

At the same size David Libre's letters stand about a tenth shorter than Frank Ruhl's (ב: 0.53em against 0.59em). So:

- **A David voice inside Frank Ruhl's text is set at `1.1em`**, `line-height: 1` — a letter, a number, a verse or a lemma is as tall as the words around it and never opens its line. In the lines that are David already (head, line, quote) they keep `1em`.
- **Every passage is set at the size of the text** — a head, a display line, a quote, the verses, a note, a table: they differ from it by face, ink or place, never by size.

| role | face | size | weight | ink | notes |
| --- | --- | --- | --- | --- | --- |
| title: book, chapter, author | David | 1.6rem | 400 | ink | three lines in that order, one style for all three; leading 1.4, balanced |
| legend | sans | 1.15rem | value 600 | ink | each value underlined in its colour (3px, as wide as the figure); no count |
| running text (`para`, `list`) | Frank Ruhl | 1.375rem (22px) | 400 | ink | leading 1.9 or more, justified, last line right, `text-wrap: pretty` |
| note (`intro`) | Frank Ruhl | text size | 400 | ink-soft | the text's leading |
| head | David | text size | 400 | ink | centered, .03em spacing, balanced |
| lead-in (`label`) | Frank Ruhl | 1.375rem | 400 | ink | set as running text, like a paragraph |
| row (`row`) | Frank Ruhl | 1.375rem | 400 | ink | running text centered; consecutive rows stacked on the leading alone, the paragraph space after the last |
| display line (`line`) | David | text size | 400 | ink | centered, .06em spacing |
| quote | David | text size | 400 | ink | centered, balanced; no panel, no rule — nothing drawn around it |
| verses | David | text size | 400 | verse | vocalized, the text's leading, on `--src-panel` |
| verse number | David | .75em | 400 | ink-soft | in parentheses |
| table | Frank Ruhl | text size | 400 | ink / ink-soft head | figures tabular, a coloured figure 600 ink-strong |
| reference `(…)` | inherits | .8em | 400 | ink-soft | plain size inside a note |
| letter `{…}` | David | 1.1em | 700 | letter | .06em spacing |
| number `[…]` | David | 1.1em | 500 | number | .05em spacing, value in the title |
| verse `«…»`, lemma | David | 1.1em | 400 / 700 | verse | |

A letter or a number glued to the prefix before it (`מ[ד׳]`, `ב{ה״א}`) gets a hair of space, `.05em`, before it (`.src-glued`) — enough to read `מ·ד׳`, never as wide as a word space.

Signs: geresh and gershayim show only in an abbreviation (`ואע״פ`, `י״י`), as the Hebrew `׳` and `״`; numbers, references, counted words and strings of letters are set without them (`docs/mekorot-typesetting.md`).

## Space and measure

- **The sheet** is 46rem wide at most, padded 2.6rem 2.8rem 3rem: a line of text holds about 65–70 letters.
- **The leading** is `--src-leading`, set by `pages/mekorot.js` on `.src-text`: `max(1.9, 1.4 + 0.27 × lanes)`, where lanes is the deepest stack of gematria rules on the sheet. The rules of a line never reach the letters of the next.
- **Blocks:** a paragraph is followed by 1.15rem; an item by .7rem; heads by .25rem, and the first text after heads by 1.8rem; a lead-in is spaced as a paragraph; the quote 1.5rem around; the verses 2rem below. The text after a note or a table opens with 2rem, a `--src-line` rule, and 1.6rem.
- **The header** keeps 2.2rem below it; its three title lines — book, chapter, author, all balanced — stay 2.6rem clear of each side, the corner of the tools.

## The gematria layer

- **The rule** is 3px, in its value's colour, painted as a background of `.src-token-ink` — the word without the punctuation at its edges, so a comma is never underlined.
- **Lane 0 sits against the word**: its top 2px above the foot of the word's box, i.e. under the descent of ק and ן with a little air. Each further lane is 5px lower. Every counted word on the sheet takes the same padding (`5 × (lanes − 1) + 2px`), so a lane runs level from word to word.
- **A counted word keeps the size of the text.** The rule is what says it is counted.
- **A selection** tints, in the grey of the ספור tab, every run on the sheet that adds up to the selected value; the tint is a background too, so nothing moves.
- **The hover card** (`.src-tip`): `--src-sheet`, `--src-line-strong` edge, radius 8px, `--src-float`; values in sans 600, phrases in David `--src-ink-soft`. One card, placed in JS and kept inside the sheet on both axes.
- **The legend** is a grid of even rows (at most six per row); each entry is the value, underlined in its colour exactly as the words it names are — never how many times it occurs. Nothing separates it from the title.

## The list of sources

Cards on the desk: `--src-sheet`, `--src-line` edge, radius 8px. Under the hand, `--src-panel` and `--src-line-strong`. The open source: `--src-panel`, `--src-gold-soft` edge, and a 3px `--src-gold` marker on its right edge. Its short name (`nav`) David 1.1rem ink-strong; author .8rem and book .75rem, ink-soft.

## The tools

A column of icon buttons in the top-left corner of the sheet, inside the frame — the corner a page leaves free: **download as PDF**, **pages** — the two-page view — then **the charter** — a link to `/charte`, which shows this file, set on the sheet it describes.

- Icons only: an arrow coming down into a tray (the ספריה's open-a-file icon turned the other way) for the PDF, two pages open on their spine (the ספריה's own two-page icon) for the view, three fanned swatches for the charter; each with its `title` and `aria-label` (`הורדת קובץ PDF`, `עמודים`, `השפה הגרפית של הדף`).
- A tool that stays on — the two-page view — is pressed: `--src-line`, `--src-line-strong` edge, ink icon, `aria-pressed`.
- 2.25rem square, radius 6px, .4rem apart: `--src-panel` with a `--src-line` edge at rest, ink-soft icon; `--src-desk`, `--src-line-strong` and ink under the hand; `--src-line` and a half-pixel nudge when pressed.
- While the file is made the PDF button stays in place, disabled, its icon replaced by a spinner of the same size.
- The column is `.src-screen-only`, like the hover card: neither is copied into the PDF.

### The two-page view

The pages the PDF will have, shown before it is made: the same cuts (`layoutPages` in `utils/sheetPdf.js`) — but no frame, no running head and no folio: the screen shows a page, not a printed sheet.

- **One spread at a time**, as a bound book opens: the first page on the right, the leaves touching at a `--src-line` spine, on `--src-sheet` with `--src-lift`. An odd count of pages gets a blank page to close the last spread.
- **The page and nothing else:** the list of sources is hidden; the spread takes the full width of the desk — or, when that would make it taller than the window, the window's full height: it is always read whole, without scrolling.
- **Turning:** from the keyboard's ← and →, or by a click on a page — the left page leads on, the right one back, as in a book; a page that can turn shows it under the hand (`w-resize`, `e-resize`).
- **The turn slides:** the two spreads lie side by side on a track that moves between them in .42s (`cubic-bezier(.22,.61,.36,1)`) — the next comes in from the left, the one before from the right. A turn asked for mid-slide is dropped; with `prefers-reduced-motion` the spread changes at once.
- **One control:** the tools and the arrows are gone from the view; only the two-page button stays, pressed, floating on the spread a little in from its top-left corner — it closes the view.
- **On screen the text is a size up** — 24px against the sheet's 22 — with half the space between lines (`24px + (sheet leading − 24px) / 2`), and the view's pages are cut under that look (`src-print-screen`); the PDF keeps the sheet's sizes. The spread is scaled with a transform, never `zoom`, so its lines fall exactly where they were cut.
- **Deep links:** the address says what is shown — `/mekorot?src=<id>` for the source, `&view=pages&page=<n>` for the two-page view open at the spread whose right-hand page is `n`. It is read once on load and rewritten (`replaceState`) as the reader moves.
- The sheet stays in the page, hidden, so the view follows the source that is open. The view is for reading: no hover card, no selection count.

## The PDF

Made in the browser by `utils/sheetPdf.js`, downloaded in one click, named after the source's short name (`nav`).

- **Paper:** A4 portrait, white. Margins 24mm at the sides and top, 26mm at the foot. A `--src-line-strong` frame, .6pt, 11mm from the edge.
- **Scale:** 1 CSS px = .6pt, so the 22px text is set at 13pt; the sheet is set again at the width of the text column (≈765px), off screen, under the same stylesheet.
- **Pictures:** each page is a picture of the sheet at 2 image pixels per CSS pixel (≈220 dpi), JPEG .92. The text of the PDF cannot be selected; everything else — faces, colours, rules — is the screen's.
- **Breaks:** never through a line; the title page whole; a paragraph leaves at least two lines at the foot of a page and two at the head of the next; a head or a lead-in stays with what follows it; a quote, the verses and a table go whole while they fit on a page. A page starts at its first line.
- **Around the text:** from the second page on, a running head — author · book, David Libre, ink-soft, 9.75pt — centred between the frame and the text; a folio, the page number in the same voice, at the foot of every page when there is more than one.
- **The file:** title (book · chapter), author, subject (the short name) and creator `ס.פ.ר` in its properties, language `he`, and pages read from right to left when shown side by side.

## Before calling a style change done

- [ ] Every colour is a `--src-` token (or a gematria colour); no new literal.
- [ ] Muted text is `--src-ink-soft`, not something lighter.
- [ ] A David piece inside Frank Ruhl text is at 1.1em with `line-height: 1`; nothing opens a line.
- [ ] Counting, selecting or hovering changes no size and moves no word.
- [ ] Rules sit against their word, and the lowest lane clears the next line.
- [ ] What depends on the window's width is scoped to `.src-root`, so the PDF's copy is untouched by it.
- [ ] The PDF of each source still breaks between lines, with its frame, running head and folio.
