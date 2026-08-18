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
 *
 * `kind: 'manuscript'` moves an entry to the כתבי יד shelf of the library. It
 * describes the document, not where the file is stored: a manuscript small
 * enough for books/ belongs on that shelf just as much as one in the release.
 */
export const bookMeta = {
  // 'sefer-yetsira.pdf': { id: 'yetsira', title: 'ספר יצירה', author: '', year: '' },
}

/*
 * --- Books too large for git ------------------------------------------------
 * GitHub refuses any file over 100 MB, and a scanned manuscript easily goes
 * past it. Those are uploaded as assets of a GitHub release instead:
 *
 *   gh release upload books-v1 my-manuscript.pdf
 *
 * A release asset answers without any `access-control-allow-origin` header, so
 * the browser cannot fetch it cross-origin — pages/api/book/[id].js proxies it
 * from our own origin, forwarding the Range requests pdf.js relies on.
 */
export const RELEASE_TAG = 'books-v1'

export function releaseAssetUrl(file) {
  return `https://github.com/viebel/sfr/releases/download/${RELEASE_TAG}/${encodeURIComponent(file)}`
}

export const releaseBooks = [
  {
    id: 'ibn-ezra-al-hatorah',
    file: 'ibn-ezra-al-hatorah.pdf',
    title: 'אבן עזרא על התורה',
    author: 'ר׳ אברהם אבן עזרא',
    // From the title page of the scan: Paris, BnF, copied 1284 (Ktiv / NLI).
    year: '1284 · Ms. hébr. 176',
    kind: 'manuscript',
    release: true
  },
  {
    id: 'sefer-hamispar-ktav-yad',
    file: 'sefer-hamispar.pdf',
    title: 'ספר המספר',
    author: 'ר׳ אברהם אבן עזרא',
    year: '',
    kind: 'manuscript',
    release: true
  }
]

// Where the reader actually loads a book from: raw.githubusercontent for the
// files committed in books/, our own proxy for the ones living in a release.
export function bookHref(book) {
  return book.release ? `/api/book/${encodeURIComponent(book.id)}` : bookUrl(book.file)
}
