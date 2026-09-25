---
name: cli-scripts
description: Language and shape of the command-line tooling in scripts/ for the ס.פ.ר (sfr) project — what a script prints, in which language, and how the library commands (yarn book, yarn books) are put together. Load before writing or editing anything under scripts/, or any developer-facing output (usage, warnings, errors, logs).
---

# Command-line scripts in ס.פ.ר

## Language

- **Everything a developer reads is in English.** Script output, usage strings, warnings, errors, progress lines, code comments, commit messages.
- **Everything a reader of the app sees is in Hebrew.** UI copy, button labels, tooltips, empty states — the app is Hebrew and RTL. That is the only exception, and it is not a fallback: never let English leak into the interface, and never let Hebrew (or French) leak into a script's output.
- If the user writes to you in French, answer in French — but what you *write into the repository* still follows the rule above.

## What a script prints

- One line per file or per step, prefixed to say what it is: `·` for a fact, `✓` for something that happened, `⚠` for a warning that does not stop the run, `✗` for a failure.
- Numbers get units and a ratio when there is one to give: `12.4 MB (38% of the original)` beats `13004221`.
- End on what is left for the human to do, as a command they can paste:
  `data/library.json updated — left to do:` followed by the `git add … && git commit … && git push` line.
- A dry run says exactly what it would have done, prefixed `(dry run)`, and touches nothing.

## Shape

- Node, CommonJS, no dependencies beyond what `package.json` already has. External tools (`gh`, `gs`) are probed with a `has()` check and their absence is reported as a warning with the `brew install …` that fixes it — never as a stack trace.
- One job per script, exposed as a `yarn` script whose name is the noun: `yarn book <file>` for one, `yarn books` for the folder sweep.
- Shared work lives in the singular script and is `module.exports`-ed; the sweep requires it. Guard the CLI with `if (require.main === module) main()`.
- Anything destructive or expensive is opt-in: `--force` to redo work already done, `--dry-run` to see first.

## The library commands

`books/` and `manuscripts/` are git-ignored staging folders — the desk. The GitHub release `books-v1` is the shelf, and `data/library.json` is the only thing about them that git carries.

- The folder decides the shelf: `books/` → `kind: 'book'`, `manuscripts/` → `kind: 'manuscript'`.
- Assets are named after an ascii id derived from the title (Hebrew is transliterated), because the name has to survive a URL.
- A file already published is recognised by its derived id, by the `source` file name recorded in the manifest, or by its title — so a book uploaded by hand under a chosen id is never republished under a transliteration.
- `yarn books` asks before it decides anything: for a new file, the title (offering the PDF's own Info title when it has one worth offering, next to the file name), the reading direction, and the id its link will carry; for a book whose file has left the desk, whether to keep it or remove it — asset and entry both. Keeping is remembered on the entry (`detached`), so the question is asked once. `--yes` takes every default, `--dry-run` writes nothing.
- Prompts read one line each through a readline async iterator, so answers can be typed or piped, and a stream that ends answers with the defaults instead of hanging. Never let a script block waiting on a stdin that will never speak.
- Files go up untouched. A release asset may weigh up to 2 GB, so nothing has to be shrunk to fit; a scan too heavy to open comfortably is compressed by hand before it is dropped in the folder. The scripts depend on `gh` alone.
