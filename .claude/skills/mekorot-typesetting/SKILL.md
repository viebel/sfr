---
name: mekorot-typesetting
description: Rules for setting a text on the מקורות page of the ס.פ.ר app — adding a source, editing one, marking letters and numbers in it, or touching how the sheet is typeset. Use whenever a Hebrew source text is added to data/sources.js or a data/*.js source file, whenever a passage is pasted in from a PDF or from a ספור-tab link to be published as a source, and whenever .src-* styles, fonts, colors or the gematria underlines of pages/mekorot.js are changed.
---

# Setting a text on מקורות

**Read `docs/mekorot-typesetting.md` before writing or editing a source.** It holds the whole convention — block types, inline marks, fonts, colors, the gematria layer — and it is the reference this skill exists to point at. Do not reconstruct the rules from the existing files; the file is shorter than the files.

These are the ones most often got wrong, so they are repeated here:

- **Every letter the text speaks about is `{…}`, every number written with letters is `[…]`.** Not just the obvious ones — `[תקצ״ה]`, `[בי״ו]`, `[ה׳] פעמים`, `{ה׳} חצי {י׳} של השם`. A number left unmarked is the most common miss.
- **Words the author writes with gershayim so they will be counted — `הכ״ל`, `כת״ר תור״ה` — stay unmarked.** They are neither letters nor numerals; the gematria underline is what marks them.
- **No geresh, gershayim, apostrophe or straight quote ever reaches the screen.** `bare()` strips them from every piece; the data keeps them, the display does not. Drop ASCII quotes around a phrase from the data outright.
- **The gematria underline is the only surlignage on the page**, and a counted word is set at `1.15em` — that size is what replaces the signs the display removed. Both sit on `.src-token-ink`, the word **without the punctuation at its edges**: nowhere in the app does a highlight run under a comma.
- **`numbers` keeps the order the colors were chosen in**; `hide` lists the runs the reading does not keep, as `value|phrase` with bare phrases — and a `hide` entry never reaches a run that covers a `{…}` or a `[…]`. **Check that every color in the legend ends with a non-zero count**: a value noted but never drawn is a `hide` that went too far.
- **Paragraphs are joined** — a PDF's column breaks are not breaks in the text — and a list item drops its `א.` for the page's lozenge.

Then check the list at the end of `docs/mekorot-typesetting.md`, in particular the token-count invariant: if `tokenizeMarked` and the analysis disagree, the block loses every underline without any error.
