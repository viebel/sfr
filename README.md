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

Deux dossiers servent de plan de travail, tous deux git-ignorés : `books/` pour
les livres imprimés, `manuscripts/` pour les manuscrits — le dossier décide du
rayon dans la bibliothèque. On y dépose les PDF, puis :

```bash
yarn books
```

publie tout ce qui n'y est pas encore et laisse le reste tranquille (`--force`
pour republier, `--dry-run` pour voir ce qui partirait). Pour un seul fichier,
n'importe où, avec ses métadonnées :

```bash
yarn book mon-livre.pdf
```

La commande téléverse le fichier tel quel, sous un nom ascii dérivé du titre, et
écrit sa ligne dans `data/library.json` — qu'il reste à commiter. Un asset de
release accepte 2 Go, donc rien n'est retouché ; un scan trop lourd se compresse
à la main avant d'être déposé. Options utiles :

```bash
yarn book --title "ספר יצירה" --author "…" --kind manuscript --dir rtl --id yetsira mon-scan.pdf
```

`--dry-run` montre ce qui se passerait sans rien envoyer.

Un asset de release ne renvoie aucun en-tête CORS : le navigateur ne peut pas le
lire directement, c'est [`pages/api/book/[id].js`](pages/api/book/[id].js) qui le
relaie depuis notre propre origine, en transmettant les requêtes `Range` dont
pdf.js a besoin pour ouvrir la page 400 sans lire les 399 d'avant.

Les originaux pleine résolution restent donc en local ; la release ne porte que
les copies de lecture.

## Deploy on Vercel

Push the code to GitHub.

