# ס.פ.ר

Play with hebrew words and letters

## Getting Started

First, install the dependencies:

```bash
yarn install
```

Then, run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## La bibliothèque

Les PDF ne sont pas dans le dépôt : ce sont des assets de la release
[`books-v1`](https://github.com/viebel/sfr/releases/tag/books-v1). Le dépôt ne
porte que leur description, dans [`data/library.json`](data/library.json), et
git ne grossit pas quand un scan pèse 170 Mo.

```bash
yarn book mon-livre.pdf
```

La commande compresse le fichier s'il dépasse 20 Mo (ghostscript, par passes de
plus en plus serrées, en gardant l'original si aucune n'y gagne), le téléverse
sous un nom ascii dérivé du titre, et écrit sa ligne dans `data/library.json` —
qu'il reste à commiter. Options utiles :

```bash
yarn book --title "ספר יצירה" --author "…" --kind manuscript --dir rtl --id yetsira mon-scan.pdf
```

`--max 40` relève le seuil de compression, `--dry-run` montre ce qui se
passerait, `--keep` garde le fichier compressé à côté de l'original.

Un asset de release ne renvoie aucun en-tête CORS : le navigateur ne peut pas le
lire directement, c'est [`pages/api/book/[id].js`](pages/api/book/[id].js) qui le
relaie depuis notre propre origine, en transmettant les requêtes `Range` dont
pdf.js a besoin pour ouvrir la page 400 sans lire les 399 d'avant.

Les scans originaux, eux, restent en local dans `manuscripts/` (git-ignoré).

## Deploy on Vercel

Push the code to GitHub.

