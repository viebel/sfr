---
name: ui-design
description: UI/UX design conventions for the ס.פ.ר (sfr) gematria app. Load this before building or restyling any UI in this project — buttons, blocks, panels, tooltips, layout. Captures the owner's design preferences so they don't have to be repeated.
---

# UI design conventions for ס.פ.ר

Follow these when creating or editing any UI in this project. They come from the app owner's repeated feedback — respect them by default.

## Palette — three tones, no more
The owner counts the greys on screen and objects when there are too many. The
tokens are declared once in `:root` (styles/globals.css); the ספריה and the app
menu are set entirely in them, and every new screen must be — older screens
still holding literal colours move onto the tokens as they are touched:

| token | value | what it is |
| --- | --- | --- |
| `--paper` | `#fff` | the page, and everything raised above the ground: buttons, inputs, the top row |
| `--ground` | `#eaecef` | the one grey — the control bar *and* the surface content lies on |
| `--line` | `#d5d8dc` | the one line, and the fill of a pressed control |
| `--line-strong` | `#a9aeb5` | a line that answers the hand: hover, focus, the active item |
| `--ink-soft` | `#82878d` | everything muted — meta text, spinners, secondary glyphs |

- **Never invent a fourth grey.** A new shade must be one of these or replace one
  of them everywhere. Text ink is `#333`, `#000` for emphasis, `--ink-soft` for
  muted — three inks, likewise.
- **A control's three states use existing tones, not new ones:** white at rest,
  `--ground` on hover (it sinks into the bar), `--line` when it is on.
- **Chrome must not be the white of the content.** A toolbar sitting against a
  white page cannot be white too — it is `--ground`. That is what the grey is for.
- Two grounds are outside this palette on purpose, and stay: מסך מלא reads on
  near-black (`#1b1c1e`), and מקורות is set on its own warm paper (`#f1ece2`).
  מקורות has a closed palette of its own, the `--src-*` tokens of
  `docs/mekorot-charter.md`, kept with the same discipline.

## Buttons
- **Icons, not text.** Action buttons use an icon only — no text label inside the button.
- **But they must clearly read as buttons.** An icon floating with a faint outline is not enough. Give every button a resting background (`--paper` on the grey bar), a visible border (`--line`), `border-radius`, a hover state (`--ground` + `--line-strong`), and an `:active` nudge. A user should never wonder whether it's clickable.
- **Nothing moves when a button is pressed.** Never render a control conditionally — a button that appears or disappears with a mode shifts every button beside it. Keep it in place and `disabled` when it does not apply.
- Add a `title` and `aria-label` so the icon's meaning is available on hover / to assistive tech.

## Block / panel headers
- **Icon titles, not text titles.** A collapsible block's header shows an icon (+ a chevron for fold state) — not a text word like "טקסט" or "התאמות".
- Where a block has a natural "key" (e.g. the color↔gematria legend), that key *is* the header/title bar of the block it describes — don't repeat it as a separate strip.

## Tooltips / popovers / speech bubbles
- **Must stay fully inside their container** — never let a bubble overflow or get clipped by the block edge. Clamp its position (measure the element, keep it within the block on both axes; flip above↔below when there's no room). A single JS-positioned tooltip clamped to the block beats per-element CSS tooltips that overflow.

## Layout
- **Fill the viewport, scroll inside blocks.** The tab fits in `100vh`; the page itself never scrolls past the viewport and there is **no horizontal scroll**. If a block's content is too tall, that block scrolls internally (`overflow: hidden auto`, `min-width: 0` on flex children to prevent x-overflow).
- Two related blocks (e.g. highlighted text + its matches list) sit **side by side**; widen the container (`max-width`) so both have room. Stack them on mobile.
- **Never spend a row on navigation.** The app menu is one row: the three ספרים and, on the same line, the screens of the open one and the name of what is open. A strip of its own costs every page of the app its height.
- **Nothing frames the content.** No border, no shadow, no held-back margin around the surface where the page is read — it runs to the edges of its frame, and what frames it is the window.

## Aesthetic
- Clean, minimal, light: `--paper` surfaces on the `--ground` grey, `--line` borders, and no shadow where a border already says it.
- Hebrew display text uses the `'David Libre', serif` font; the app is **RTL**.
- Highlighted-text passages are **justified** (`text-align: justify`).

## Reminder
When in doubt, prefer icon + strong affordance over text, keep overlays inside their block, keep everything within one viewport with internal scrolling, and reach for a token before reaching for a colour.
