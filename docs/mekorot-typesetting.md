# Setting a source on the מקורות page

Everything a source needs in order to look like the other ones: the data it is written in, the marks its text carries, the type it is set in, and what the gematria layer is allowed to do to it. `/mekorot` is a printed page, not a form — a source that follows these rules needs no CSS of its own.

## Where a source lives

One source is one exported object. Short ones sit in `data/sources.js`; anything longer gets its own file next to it (`data/ibnEzra.js`, `data/otsarEdenGanuz.js`) and is imported there. `sources` is the ordered array the page's side list shows, so a new entry's position in it is its position on screen.

```js
export const someSource = {
  id: 'abulafia-sefirot',      // ascii, this is the /mekorot?src=… deep link
  nav: 'י׳ ספירות בלימה',       // the side list's title, and the PDF's file name
  book: 'אוצר עדן גנוז',        // the title, line 1 — the book, without ספר
  chapter: 'חלק א׳',            // the title, line 2, its subtitle — chapter, folio, verse: where in the book
  author: 'ר׳ אברהם אבולעפיא',  // the title, line 3
  numbers: [485, 540, 55],     // optional: turns the gematria layer on
  hide: ['30|כי'],             // optional: runs the reading does not keep
  blocks: [ /* … */ ]
}
```

**A title is three lines, in this order: the book, the chapter under it (the subtitle), the author under both.** The header (those three, and the legend under them) is drawn from those fields. Never write a heading block that repeats one of them.

## The blocks

A block is `{ type, text }`, except `verses`. The type is a role in the page, not a style — pick the role and the setting follows.

| type | what it is | how it is set |
| --- | --- | --- |
| `intro` | a note of this edition, not a line of the source | small, grey, above a rule that separates it from the text |
| `head` | a heading line of the original | centered, David Libre, no gematria of its own to speak of |
| `label` | a lead-in announcing what comes next | set exactly as running text; the PDF keeps it on the page of what it announces |
| `para` | running text | justified, last line to the right |
| `list` | one item of a list | gold lozenge in the margin, no number in the text |
| `line` | a display line — permutation tables and the like | centered, letter-spaced |
| `row` | a line of the text set as one of a short column of statements (`אבגד מתגלגל ו פעמים. א בראש התיבה`, then the next) | running text, centered, no paragraph space between consecutive rows |
| `quote` | a passage the author quotes from another book | running text, centered, nothing drawn around it |
| `table` | the figures a note reckons with | `{ type: 'table', head: [...], rows: [[...]] }`, small, ruled, first cell of a row is its label; like an `intro`, the last one before the text sits above the rule |
| `verses` | the biblical passage a commentary hangs on | `{ type: 'verses', verses: [{ n, text }] }`, vocalized, brown |

`intro`, `table` and `verses` are the three the gematria layer never touches. An `intro` and a `table`'s row labels still carry the inline marks — `'הנותר, סימן [בי״ו] [תקצ״ה]'` — so a number named in a label is set like the same number in the text. A label gets no underline, so there a counted word like `הכ״ל` is marked `[…]` too — `'[תפ״ה] ו[הכ״ל], חצי שעה'` — or it would read as an ordinary word. A figure cell may carry its סימן after it — `'793 [תשצ״ג]'` — and the letters are set beside the figure, marked like the text's; the figure itself stays a plain string. Everything else is analyzed.

An `intro` may carry a decimal gloss in parentheses — `[תק״ם] (540)` — so a number is readable both ways. Parentheses are normally set as a source reference; inside `.src-intro` that styling is neutralized, so there a parenthesis is just a parenthesis.

Two block-level habits:

- **A list item carries no marker.** The original's `א.` / `ב.` is dropped; the lozenge is the marker.
- **A paragraph is one line in the data.** Source texts are pasted from a PDF and arrive broken at the column width; join those lines back into one string. A blank line in the original is a new block, not a `\n`.

## The marks inside the text

`utils/sourceText.js` defines four inline marks. They are never displayed — they choose a setting.

| mark | for | set as |
| --- | --- | --- |
| `{…}` | a letter, or a run of letters, the text is speaking *about* | David Libre bold, blue `#1c5b7a`, letter-spaced |
| `[…]` | a number written with letters | David Libre, ochre `#8a6a12`, its value in the hover title |
| `«…»` | a verse quoted inside the commentary | David Libre, brown `#7a3b12` |
| `(…)` | a source reference | detected on its own, small and grey — do not mark it |

`block.lemma` sets the opening words a commentary hangs on, in bold brown.

What goes in which is a reading decision, and it is the one to get right:

- `{א׳ג׳ה׳ז׳ט׳}`, `{ה׳} חצי {י׳} של השם` — letters as letters.
- `[כ״ב] אותיות`, `[תקצ״ה] הנותרים על [בי״ו]`, `[תק״ם] חלקים` — letters standing for a count.
- `הכ״ל`, `כת״ר תור״ה`, `חצ״י השע״ה בכ״ל` — ordinary words the author writes with gershayim so they will be counted. **These stay unmarked.** The gematria underline is what says they are counted; see below.

## Gershayim and geresh: only in an abbreviation

- **An abbreviation keeps them**: `ואע"פ` is set `ואע״פ`, `י״י` stays `י״י`, `ר׳` before a name too, as the Hebrew `״` and `׳` whatever the data typed. The abbreviations are listed in `ABBREVIATIONS` in `pages/mekorot.js`; a new one in a source goes on that list.
- **A number written with letters drops them**, and so do the numbers of a reference: `[כ״ב]` is set `כב`, `(משלי כ״ז:י״א)` is set `(משלי כז:יא)`. The ochre, or the reference's small grey, says it is a number — no sign is needed to say that a letter counts.
- **A word the author marked to be counted drops them**: `כת״ר תור״ה`, `עשרי״ם`, `הכ״ל`, `יהו״ה` are set `כתר תורה`, `עשרים`, `הכל`, `יהוה`; the gematria rule under them is what says they are counted. Inline verses follow the same rule.
- **A string of letters `{…}` drops them**: `{א״ה}` is set `אה` — the blue and the letterform already say it is letters.
- **The title follows the same rule**: `חלק ת׳ עניין א׳` is set `חלק ת עניין א`, `שמות ג׳:ט״ו` `שמות ג:טו`, and `ר׳ אברהם` keeps its geresh.

The data files keep every sign — they tell the next reader how the author wrote it — and the gematria analysis runs on the plain text with its marks intact, so nothing about the values changes.

A `verses` block is rendered directly, not through `Piece`, and keeps its massoretic punctuation.

Straight ASCII quotes around a phrase (`'תק״ם'`) are not a mark of anything. Drop them from the data.

## The gematria layer

`numbers` is the list of values highlighted, **in the order their colors were picked** — the order is the color assignment, so preserve it when copying a reading over from the ספור tab.

- Every word (or run of consecutive words) whose value is in `numbers` gets a colored underline, stacked in lanes when runs overlap.
- **The underline is the only surlignage on the page.** Letters and numbers signal themselves by ink color and letterform; nothing else gets a background.
- **The rule stops at the word.** The punctuation at a token's edges — the comma that follows it, an opening bracket before it — sits outside `.src-token-ink`, so it is never underlined. The whole app follows this: the ספור tab paints its rules and its revealed-sequence tint on the same inner span.
- **A counted word keeps the size of the text around it**, and so does a selected one: the rule and the tint are painted under the word, never set into it, so nothing on a line moves. The rule is what says a word is counted. Lane 0 sits against the word, each further lane 5px lower — the geometry is in `docs/mekorot-charter.md`.
- **Hovering a counted word opens `.src-tip`**, one card listing every value that covers it with its phrase; hovering a bare `[…]` number shows that number's value. A single card, positioned in JS and clamped inside `.src-sheet` on both axes, flipping under the word when there is no room above — never a per-element CSS tooltip that can overflow the sheet.
- Each block is analyzed on its own, so a run never crosses a block.
- **A figure in a `table` cell whose value is in the legend is underlined in its color** (`.src-table-num`), so a reckoning and the text point at the same numbers with the same marks.
- **Selecting text picks its value.** A word, a run of words or a figure selected anywhere on the sheet is counted (a figure as itself), and every run on the page that adds up to it is tinted grey, as on the ספור tab — words in the analyzed blocks, `[…]` numbers in intros and table labels, table figures. The card shows the value and how many there are; a click anywhere clears it.
- **The legend rows are even.** `.src-legend` is a grid whose column count comes from the number of colors (`--legend-cols`, at most six per row), so nine values read as 5 + 4 instead of wherever the wrap happened to fall.

`hide` drops the runs a reading does not keep — a value that lands on an ordinary word, or on a pair of words the passage never joins. Each entry is `value|phrase`, the phrase written as the ספור panel shows it (no geresh, no gershayim): `'55|כי כה'`, `'30|כי'`. Every occurrence of the run goes, in every block — **except a run that covers a `{…}` or a `[…]`**. What the author wrote as a number or as letters is never noise, so `'30|כי'` drops the ordinary word כי and leaves `[כ״י]` counted. That exception is what keeps a value from vanishing off the sheet altogether: the legend shows no count, so before calling a reading done, check that every color draws at least one rule.

## Type and color

The look of the sheet — its tokens, its type scale, its spacing, the gematria rules, the PDF — is `docs/mekorot-charter.md`. What a source needs to know of it:

- Running text is Frank Ruhl Libre `1.375rem`; every voice that is not running text — heads, display lines, letters, numbers, verses, titles — is David Libre. That contrast between the two faces is what carries the page.
- Each kind of mark has its token: `--src-letter` blue for `{…}`, `--src-number` ochre for `[…]`, `--src-verse` brown for `«…»` and the lemma, `--src-ink-soft` for a reference and for an editorial note. A source never brings a colour of its own.
- The sheet is `46rem` wide, framed by a thin inner rule, and the page scrolls inside `.src-page` — the window itself never scrolls. The same sheet, set at the width of an A4 column, is what the PDF button downloads.

## Before calling a source done

- [ ] Nothing in the header is repeated as a block.
- [ ] Every letter spoken about is `{…}`; every number written with letters is `[…]`; ASCII quotes around a phrase are gone.
- [ ] Paragraphs are joined, list markers dropped.
- [ ] `numbers` is in the order the colors were chosen; `hide` uses bare phrases.
- [ ] Every color in the legend draws at least one rule on the sheet — a value noted but never drawn means a `hide` entry went too far.
- [ ] `tokenizeMarked(block.text).length` equals the analysis's token count — otherwise the block silently loses its underlines. A marker that swallows whitespace is the usual cause.
