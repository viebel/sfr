# books/

הספרייה של `/rtl` — קובצי PDF המוגשים ישירות מ‑GitHub.

The PDF library shown in the reader at `/rtl`.

## Adding a book

1. Drop the PDF in this folder (sub-folders are allowed).
2. Optionally add an entry in [`data/books.js`](../data/books.js) to set a Hebrew
   title, an author, a year, and a stable ascii `id` for the `/rtl?book=…` link.
3. Commit and push. The list is built from this folder at build time, so the new
   book appears on the next deploy.

The files are **not** copied into the deployment: the reader fetches each one
from `https://raw.githubusercontent.com/viebel/sfr/main/books/…` at runtime.

## En local

`yarn dev` sert les PDF de ce dossier depuis le disque (`pages/api/books`), donc
un livre se lit **avant** d'être poussé sur GitHub. En production c'est
`raw.githubusercontent.com` qui prend le relais, sans que rien ne change dans la
page. Pour forcer l'une ou l'autre source :

```bash
NEXT_PUBLIC_BOOKS_BASE=/api/books/ yarn dev   # disque local
NEXT_PUBLIC_BOOKS_BASE=https://raw.githubusercontent.com/viebel/sfr/main/books/ yarn dev
```

## Trop gros pour git : la release `books-v1`

Au-delà de ~100 MB, GitHub refuse le fichier — un manuscrit scanné dépasse vite.
Ces livres-là ne sont pas dans le dépôt : ils sont attachés à une **release**,
et déclarés dans `releaseBooks` de [`data/books.js`](../data/books.js).

```bash
# 1. compresser le scan (JPEG q55, ~0.7x — vérifié lisible sur ces manuscrits)
gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dQUIET -dFastWebView=true \
   -dPassThroughJPEGImages=false \
   -dAutoFilterGrayImages=false -sGrayImageFilter=DCTEncode \
   -dAutoFilterColorImages=false -sColorImageFilter=DCTEncode -dJPEGQ=55 \
   -dDownsampleGrayImages=true -dGrayImageResolution=50 -dGrayImageDownsampleThreshold=1.0 \
   -dDownsampleColorImages=true -dColorImageResolution=50 -dColorImageDownsampleThreshold=1.0 \
   -o mon-livre.pdf "manuscripts/mon livre.pdf"

# 2. l'attacher à la release
gh release upload books-v1 mon-livre.pdf
```

Puis ajouter une entrée dans `releaseBooks` et pousser.

⚠️ Un asset de release ne renvoie **aucun** en-tête CORS : le navigateur ne peut
pas le lire directement. C'est `pages/api/book/[id].js` qui le relaie depuis
notre propre origine (en transmettant les requêtes `Range`, pour que pdf.js
n'ait pas à télécharger tout le livre avant d'afficher une page).

Les scans originaux restent en local dans `manuscripts/` (git-ignoré).

## Limits to keep in mind

- GitHub warns above **50 MB** per file and refuses anything above **100 MB**.
  Scanned seforim usually need to be down-sampled first
  (`gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -o small.pdf big.pdf`).
- Every push of a PDF stays in the git history forever — the repo only grows.
- `raw.githubusercontent.com` is not a CDN. For faster, cached delivery switch
  `BOOKS_BASE` in `data/books.js` to
  `https://cdn.jsdelivr.net/gh/viebel/sfr@main/books/` — but jsDelivr caps files
  at 20 MB and caches a branch ref for ~12 h.
