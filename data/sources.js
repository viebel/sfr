// The מקורות of the ספר section: texts on language, letters and number.
//
// Every block is { type, text } (or { type: 'verses', verses: [...] }):
//   head   a heading line of the original (set apart, centered)
//   para   running text
//   list   an item of a list, marked with a small lozenge
//   quote  a passage the author quotes from another book
//   line   a display line — permutation tables and the like
//   label  a lead-in line introducing what follows
//   intro  a note of this edition, before the text itself (never analyzed)
//   verses the biblical passage a commentary hangs on
//
// The text uses the markup of utils/sourceText.js: {letters}, [numbers as
// letters], «verses quoted inline» and (references), which are auto-detected.
//
// `numbers` turns on the gematria highlighting of the ספור tab for that source,
// and `hide` drops the runs that reading does not keep.

import { ibnEzra } from './ibnEzra'
import tseruf from './blocks/abulafia-tseruf.json'
import { otsarEdenGanuz } from './otsarEdenGanuz'

const abulafia = {
  id: 'abulafia-tseruf',
  nav: 'צירוף האותיות',
  author: 'אברהם אבו אל עפיא',
  book: 'אור השכל',
  chapter: 'חלק ת׳ עניין א׳ סימן ע׳ כולל צירוף האותיות',
  // The gematriot drawn under the text (ספור tab, right panel)
  numbers: [1214, 232, 1231],
  // Runs the reading does not keep. `!` drops a run even where it covers
  // letters: אב מן אבגדה או אבג מן אבגדהו and אבגדהו או אבגדהוז לעולם add up
  // to 232, and are not read so.
  hide: ['!232|אב מן אבגדה או אבג מן אבגדהו', '!232|אבגדהו או אבגדהוז לעולם'],
  blocks: tseruf
}

export const sources = [abulafia, otsarEdenGanuz, ibnEzra]
