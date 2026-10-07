// ר׳ אברהם אבולעפיא, ספר אוצר עדן גנוז, חלק א׳ — י׳ ספירות בלימה.
// Markup: {letters} · [numbers written with letters] · «verses» · (references)

import blocks from './blocks/abulafia-sefirot.json'

export const otsarEdenGanuz = {
  id: 'abulafia-sefirot',
  nav: 'הכל בחצי שעה',
  author: 'ר׳ אברהם אבולעפיא',
  book: 'אוצר עדן גנוז',
  chapter: 'חלק א׳ · הכל בחצי שעה',
  // The gematriot drawn under the text, in the order their colors were chosen
  numbers: [485, 540, 30, 25, 204, 55, 595, 87, 108],
  // Runs the reading does not keep: a value that lands on an ordinary word, or
  // on a pair of words the passage never joins. Written `value|phrase`, with the
  // phrase as the panel shows it (no geresh, no gershayim); every occurrence of
  // the run is dropped.
  hide: ['595|תפה עם', '595|נתלה בחצי', '55|כי כה', '30|כי', '204|וזהו ענין'],
  blocks
}
