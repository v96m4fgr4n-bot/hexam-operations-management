---
name: design-taste-frontend
description: Senior UI/UX design principles for this app's HTML/CSS screens - typography, color, layout, motion, and anti-slop rules. Use when adding or restyling a screen, card, form, chart, or any visual element in this project.
---

# High-Agency Frontend Skill (adapted for this project)

Source: https://github.com/tasteskill/tasteskill (`taste-skill`, MIT). The
original targets React/Next.js/Tailwind/Framer Motion projects; this repo is
plain server-rendered HTML templates (`src/*.html`), hand-written CSS in
`CSS.html` (custom properties, no Tailwind), and vanilla JS (no framework,
no npm build, no animation library). This version keeps the framework-
agnostic design principles and rewrites everything else — dependency
checks, Tailwind classes, Framer/GSAP directives, `shadcn/ui` — as plain
CSS/vanilla-JS equivalents, or drops it where there's no equivalent.

## Baseline for this project
* Layout variance: moderate — this is a data-dense ops tool (tables, forms,
  KPI tiles), not a marketing site. Favor clarity over asymmetry.
* Motion: light — CSS transitions on hover/focus/state-change only. No
  scroll-triggered or perpetual/infinite animations (there's no animation
  library and no build step to justify pulling one in).
* Density: matches context — spacious on Dashboard/New Trip, tighter on
  data tables (Trip History, Accounting ledger, Audit Log).

## Architecture & conventions (this project, not the original's)
* Follow existing patterns: templated `.html` view fragments included from
  `Index.html`, `CSS.html`'s `:root` custom properties (`--ink-*`,
  `--accent`, `--ok`/`--warn`/`--danger`, spacing/radius/shadow tokens),
  vanilla JS event listeners and `google.script.run` calls in
  `JavaScript.html`.
* No 3rd-party UI/animation libraries and no icon fonts — this app already
  uses inline SVG for the sidebar icons; keep using that, not an icon
  library.
* Responsive: reuse the existing `.form-grid` (`repeat(auto-fit,
  minmax(160px, 1fr))`) and the `@media (max-width: 768px)` breakpoint
  already in `CSS.html`. Prefer CSS Grid with `auto-fit`/`minmax()` over
  flexbox percentage math for any new layout.

## Design engineering directives (bias correction)

**Typography** — one clear display size per screen (`--fs-xl`/`--fs-2xl`
already defined), body text at `--fs-md`/`--fs-sm`. Don't introduce a new
font; this app doesn't load a custom webfont. Avoid oversized, screaming H1s
— control hierarchy with weight and color (`--ink-0` vs `--ink-4`), not just
size.

**Color calibration** — this app already follows the rule: one accent
(`--brand-blue`), neutral ink scale for everything else, and a fixed
status palette (`--ok`/`--warn`/`--danger`/`--info`) for state. Don't add a
second accent color or a gradient. Keep new UI inside the existing token
set in `CSS.html` rather than hardcoding new hex values.

**Layout diversification** — avoid centering everything by default; use
left-aligned headers with right-aligned data/actions (already the pattern
in `.page-head`). Don't default every new section to a 3-equal-column card
row — a `.breakdown-list` (label/value pairs) or a table often reads better
for this kind of data than another row of cards.

**Materiality** — use `.card`/`--shadow-sm` only where grouping actually
needs a boundary; for dense tables, prefer `border-bottom` row dividers
(already the pattern in `th, td`) over boxing every row.

**Interactive states** — every new async action needs a loading state
(`Loading…` placeholder, already the convention), an empty state
(`.empty-state`, already defined), and an error state (`.msg.error`,
already defined) — don't ship a screen that only handles the success path.
On `:active`, a `translate-y-[1px]`-equivalent (`transform:
translateY(1px)`) is enough tactile feedback — no need for anything heavier.

**Forms** — label above input (already the convention in `CSS.html`), a
`.hint` line for helper text when needed, error text via `.msg.error`
under the field group. Keep consistent vertical rhythm with the existing
`.form-grid` gap.

## Performance guardrails
* Animate only `transform` and `opacity`, never `top`/`left`/`width`/
  `height` — this holds just as much for a plain CSS `transition` as for a
  JS animation library.
* No arbitrary high `z-index` values — this app already reserves z-index
  for real layering needs (topbar, sidebar, `.modal-overlay`); match that,
  don't invent a new stacking context casually.

## Forbidden AI-tell patterns (keep avoiding these)
* No neon/outer glow `box-shadow`s — use the existing tinted, wide-spread
  shadow tokens (`--shadow-sm`/`--shadow-md`).
* No pure black (`#000000`) — this app already uses `--ink-0` (`#0D1E2C`),
  not true black.
* No oversaturated accent colors, no gradient-filled text on headers.
* No generic "3 equal cards in a row" as the default for every new feature
  section — vary it (a list, a table, an asymmetric split) based on what
  the data actually is.
* No placeholder content that looks obviously fake: no "John Doe", no flat
  round numbers (`50%`, `100.00`) in mock/example data, no filler
  marketing words ("Elevate", "Seamless", "Unleash", "Next-Gen") in UI copy
  — this is an operations tool, not a landing page; copy should be plain
  and specific (e.g. "Record payment", not "Unlock your payment flow").
* No broken/placeholder image links.

## Ideas worth drawing from (as CSS/vanilla-JS, not a library)
These are inspiration for *what* an interaction could look like, not a
mandate to implement all of them — and none of them require a JS
animation library, since this project doesn't have one:
* A subtle staggered fade-in for a freshly-rendered table's rows via CSS
  `animation-delay: calc(var(--row-index) * 30ms)`, used sparingly.
* A spotlight/tinted border on hover for a card that's clickable, via a
  plain CSS `:hover` rule — not a mouse-tracking JS effect.
* Skeleton loaders shaped like the real layout instead of a generic
  spinner, for anything slower than an instant `google.script.run` round
  trip.

## Final check before shipping a UI change
- [ ] Uses existing `CSS.html` tokens instead of new hardcoded colors/sizes?
- [ ] Loading, empty, and error states all handled, not just the happy path?
- [ ] Mobile layout (`< 768px`) still works — no horizontal scroll introduced?
- [ ] Animates only `transform`/`opacity`, and only where it adds clarity?
- [ ] No AI-tell patterns from the list above snuck in?
