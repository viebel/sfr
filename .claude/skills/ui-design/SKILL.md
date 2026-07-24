---
name: ui-design
description: UI/UX design conventions for the ס.פ.ר (sfr) gematria app. Load this before building or restyling any UI in this project — buttons, blocks, panels, tooltips, layout. Captures the owner's design preferences so they don't have to be repeated.
---

# UI design conventions for ס.פ.ר

Follow these when creating or editing any UI in this project. They come from the app owner's repeated feedback — respect them by default.

## Buttons
- **Icons, not text.** Action buttons use an icon only — no text label inside the button.
- **But they must clearly read as buttons.** An icon floating with a faint outline is not enough. Give every button a solid resting background (e.g. `#eef0f2`), a visible border, `border-radius`, a hover state (darker bg + border), and an `:active` nudge. A user should never wonder whether it's clickable.
- Add a `title` and `aria-label` so the icon's meaning is available on hover / to assistive tech.

## Block / panel headers
- **Icon titles, not text titles.** A collapsible block's header shows an icon (+ a chevron for fold state) — not a text word like "טקסט" or "התאמות".
- Where a block has a natural "key" (e.g. the color↔gematria legend), that key *is* the header/title bar of the block it describes — don't repeat it as a separate strip.

## Tooltips / popovers / speech bubbles
- **Must stay fully inside their container** — never let a bubble overflow or get clipped by the block edge. Clamp its position (measure the element, keep it within the block on both axes; flip above↔below when there's no room). A single JS-positioned tooltip clamped to the block beats per-element CSS tooltips that overflow.

## Layout
- **Fill the viewport, scroll inside blocks.** The tab fits in `100vh`; the page itself never scrolls past the viewport and there is **no horizontal scroll**. If a block's content is too tall, that block scrolls internally (`overflow: hidden auto`, `min-width: 0` on flex children to prevent x-overflow).
- Two related blocks (e.g. highlighted text + its matches list) sit **side by side**; widen the container (`max-width`) so both have room. Stack them on mobile.

## Aesthetic
- Clean, minimal, light: white surfaces, subtle grey borders (`#eee`/`#ddd`), soft shadows.
- Hebrew display text uses the `'David Libre', serif` font; the app is **RTL**.
- Highlighted-text passages are **justified** (`text-align: justify`).

## Reminder
When in doubt, prefer icon + strong affordance over text, keep overlays inside their block, and keep everything within one viewport with internal scrolling.
