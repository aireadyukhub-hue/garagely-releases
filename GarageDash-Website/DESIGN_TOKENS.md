# GarageLY Design Tokens

The starting point for any future site (including the other company's) —
copy `motion-kit.css` + `motion-kit.js` as-is, then swap these values.

## Colour

| Token | Value | Use |
|---|---|---|
| `--orange` | `#F4A523` | Brand accent — CTAs, links, highlights |
| `--orange-dark` | `#d4891a` | Hover state for orange elements |
| `--bg` | `#0f1117` | Page background (dark theme) |
| `--bg2` | `#161820` | Card/panel background |
| `--bg3` | `#1e2030` | Nested panel background (inputs, mock UI) |
| `--border` | `#2a2d3e` | Borders / dividers |
| `--text` | `#e8eaf0` | Primary text |
| `--muted` | `#8b8fa8` | Secondary/muted text |

## Type

- Font: **Inter** (Google Fonts), weights 400/500/600/700/800
- Hero heading: `clamp(2.2rem, 5vw, 3.5rem)`, weight 800, `letter-spacing: -0.02em`
- Body: `1.15rem` hero copy / `1rem` general, `line-height: 1.6`

## Shape & spacing

- Corner radius: `10px` buttons, `12–20px` cards
- Buttons: `0.85rem 2rem` padding, `font-weight: 700`
- Section rhythm: `6rem` top padding on hero, generous whitespace between sections

## Motion (`motion-kit.css` + `motion-kit.js`)

Framework-free scroll/entrance animation, reusable on any static site —
no build step, no dependencies.

- `.hero-in`, `.hero-in-delay-1/2/3` — fade+rise on page load, for above-the-fold
  content. Stack the delays to sequence badge → heading → copy → buttons.
- `.reveal` — fades+rises the first time an element scrolls into view.
- `.reveal-stagger` — same, but staggers its direct children (e.g. a feature
  grid) so cards animate in one after another rather than all at once.
- Respects `prefers-reduced-motion` automatically.

Usage: `<link rel="stylesheet" href="/motion-kit.css">` in `<head>`,
`<script src="/motion-kit.js"></script>` before `</body>`, then add the
classes above to whatever markup should animate.

## Applied on getgaragely.com

Hero (staggered load-in), the mock screenshot, the feature grid (staggered),
the pricing card, and the download card all use this kit — see `index.html`
for the reference implementation.
