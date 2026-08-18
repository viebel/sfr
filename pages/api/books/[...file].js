/*
 * En développement les PDF de books/ ne sont pas encore (ou pas forcément)
 * poussés sur GitHub : cette route les sert depuis le disque, pour que la
 * bibliothèque se lise avant tout commit. Sur Vercel elle est désactivée —
 * la production lit les fichiers depuis raw.githubusercontent (data/books.js).
 */
import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  if (process.env.VERCEL) return res.status(404).end()

  const root = path.join(process.cwd(), 'books')
  const rel = [].concat(req.query.file || []).join('/')
  const full = path.join(root, rel)

  // path.join normalise déjà les .. ; on vérifie qu'on n'est pas sorti de books/
  if (!full.startsWith(root + path.sep) || !/\.pdf$/i.test(full) || !fs.existsSync(full)) {
    return res.status(404).end()
  }

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Length', fs.statSync(full).size)
  fs.createReadStream(full).pipe(res)
}
