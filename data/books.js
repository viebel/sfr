/*
 * The library is served straight from GitHub in production: the PDFs live in books/ at the
 * repo root — deliberately not in public/ — so they never enter the Vercel
 * deployment. The reader fetches them cross-origin from raw.githubusercontent,
 * which answers with `access-control-allow-origin: *`, so pdf.js can read them.
 *
 * Adding a book: drop the PDF in books/, commit, push. It shows up on its own;
 * the entry in bookMeta below is optional and only refines what is displayed.
 */
const GITHUB_BASE = 'https://raw.githubusercontent.com/viebel/sfr/main/books/'

// En dev les fichiers ne sont pas encore sur GitHub : on les lit sur le disque,
// via pages/api/books. NEXT_PUBLIC_BOOKS_BASE force l'un ou l'autre au besoin.
export const BOOKS_BASE =
  process.env.NEXT_PUBLIC_BOOKS_BASE ||
  (process.env.NODE_ENV === 'production' ? GITHUB_BASE : '/api/books/')

// Path segments are encoded one by one so Hebrew (and spaces) in a file name
// survive, without turning the slashes of a sub-folder into %2F.
export function bookUrl(file) {
  return BOOKS_BASE + String(file).split('/').map(encodeURIComponent).join('/')
}

/*
 * Optional metadata, keyed by the file's path inside books/. A PDF with no
 * entry here still appears in the library: its file name (minus .pdf) becomes
 * the title and its id. Give an ascii `id` to any book whose file name is
 * Hebrew — the id is what ends up in the shareable /rtl?book=… link.
 */
export const bookMeta = {
  // 'sefer-yetsira.pdf': { id: 'yetsira', title: 'ספר יצירה', author: '', year: '' },
}
