# Visual reference — Black Orbit (blackorbit.site)

Owner: Claude · Captured 2026-10-16 from https://www.blackorbit.site (page title "Founder Orbit | Commercialization Intelligence"), live browser, viewport ≈780 px wide plus computed-style and stylesheet inspection.

Purpose: understand the visual language of the ecosystem so Orbit GTM Studio feels like a sibling product **without copying** Black Orbit's page, code, copy, logo or illustrations. Everything below is observation; what we adopt is decided in [SPEC.md](SPEC.md).

## 1. Typography (computed styles)

| Role | Family | Size / weight / line-height | Tracking | Evidence |
|---|---|---|---|---|
| Display h1 | Space Grotesk | 48px / 700 / 1.08 (mobile `clamp(40px, 11.5vw, 64px)`, lh 1) | -0.02em (-0.96px) | `h1` computed |
| h2 | Space Grotesk | 32px / 700 / 1.08 (mobile `clamp(32px, 9vw, 46px)`) | -0.02em | `h2` computed |
| h3 | Space Grotesk | 24px / 700 / 1.15 | -0.02em | `h3` computed |
| Body | Inter | 16px / 400 / 1.55 | normal | `main p` computed |
| Lead | Inter | 18px / 400 / 1.55, muted color | normal | `p.lead` |
| Eyebrow / nav / buttons | Inter | 13–14px / 500–600, **UPPERCASE** | +0.06 to +0.12em | `p.eyebrow`, `nav a`, `.btn` |
| Fallback stack | Montserrat (loaded as `--font-brand`) then Arial | — | — | `:root --font-sans` |

Pattern: geometric grotesk for headings, neutral humanist sans for everything else, small uppercase tracked labels as the "system voice".

## 2. Color tokens (from `:root` / `[data-theme]` custom properties)

Light theme (landing scope `.bo-home`):

| Token | Value | Use observed |
|---|---|---|
| `--bg` | `#f4f7f4` | page background — a very slightly green-tinted off-white |
| `--surface` | `#ffffff` | cards, pill buttons |
| `--text` | `#06120a` | headings, body |
| `--muted` | `#46564c` | lead and secondary copy |
| `--line` | `#cfdad2` | hairline borders, header divider |
| `--accent-text` | `#007a2f` | eyebrow labels, link hover |
| `--neon` | `#00ff5a` | primary button fill, active orbit node |
| `--mint` | `#00ff5a29` (16% neon) | highlighted "output" panels |

Dark theme (`[data-theme="dark"]`): background `#070807`, surface `#101412`, elevated `#161b18`, foreground `#f5f7f5`, muted `#8b938c`, border `#2a312c`, accent `#20fa80`, mint `#7dffb6`, warning `#c4b07a`, danger `#e85d4c`.
Semantic light: success `#0a9a4e`, warning `#8a7340`, danger `#b42318`, focus `#0a9a4e`.

### Measured contrast (WCAG 2.x, computed by us)

| Pair | Ratio | Verdict |
|---|---|---|
| text `#06120a` on bg `#f4f7f4` | 17.7 | AAA |
| muted `#46564c` on bg | 7.2 | AAA |
| accent-text `#007a2f` on bg | 5.1 | AA |
| on-accent `#04140c` on neon `#00ff5a` | 13.9 | AAA |
| **neon `#00ff5a` on light bg** | **1.26** | fails — never usable as text/icon on light |
| light accent `#12d66a` on white | 1.94 | fails as text |
| light success `#0a9a4e` on white | 3.66 | large text / UI only, not body |
| dark muted `#8b938c` on `#070807` | 6.4 | AA |
| dark accent `#20fa80` on `#070807` | 14.4 | AAA |
| hairline `#cfdad2` on bg | 1.33 | decorative only — too weak for input boundaries (needs 3:1) |

## 3. Spacing, shape, layout

- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px (`--space-1…9`).
- Radii: 8 (sm) · 16 (md, cards) · 20 (lg) · 999 (pills). Chips 12px.
- Controls: `--control-h: 44px` (meets touch target guidance).
- Container: max 1280px, 20px side padding. Sections: 48px vertical rhythm, hero 64/96.
- Cards: white surface, 1px hairline border, radius 16–20, padding 32 (20 on mobile), **no shadow** — elevation is declared by border only.
- Header: sticky, bg at 90% opacity + `backdrop-filter: blur(12px)`, 1px bottom hairline, uppercase nav links.
- Breakpoints observed: 360, 600, 700, 800, 900, 960, 1024, 1100 px. Main collapse at 900 (nav → toggle panel with 48px-tall tinted rows; 2-col grids → 1 col) and 600 (headings clamp, grids → single column).

## 4. Components observed

- **Pill buttons**: 44px tall, 24px horizontal padding, uppercase 14/600, +0.06em. Primary = neon fill + near-black text; secondary = transparent with 1px ink outline.
- **Theme toggle**: pill, white, hairline border, "◐ Dark" label.
- **Status rows** (hero example card): leading state glyph (✓ / ● / ○), bold title, muted bracketed placeholder, trailing uppercase status word (DONE / NOW / NEXT).
- **Tabs**: real `role="tablist"` / `role="tab"` with `aria-selected` for the 5-stage process (01 Hypothesis … 05 Next step), each panel structured as labelled rows (What happens / What is captured / What the founder decides / Output).
- **Evidence ladder**: 7 rungs Opinion → Repeat purchase, each with a strength tag WEAK / MODERATE / STRONG.
- **Status vocabulary** in product mockups: VALIDATED, IN PROGRESS, INVALIDATED, INCONCLUSIVE.
- **Dashed chips** (1px dashed muted border, radius 12) for "problems without a system", slightly rotated (±0.8°).
- **Highlighted output panel**: mint background with a 4px neon left border.

## 5. Motion & interaction

- Hover: buttons lift `translateY(-2px)` (0.2s transform); nav links shift to accent color; `:active` → `scale(0.98)`.
- Focus: `:focus-visible` outline 2–3px in the focus color with 2–3px offset; SVG orbit nodes get a thicker focus stroke. Keyboard-operable SVG nodes (`role="button"`, `aria-pressed`).
- Hero orbit: SVG diagram of the 5-stage loop; a small dot travels the ellipse via SMIL `animateMotion` (continuous); halo circles fade with `opacity .3s`; prev/next circular step buttons and "Stage N of 5" counter.
- Scroll: content enters as it scrolls into view (sections render blank until revealed in our capture).
- Reduced motion: a global `prefers-reduced-motion: reduce` block sets transition/animation durations to 0.01ms, disables smooth scroll and removes button transitions — a thorough implementation.
- Design-system easing token: `--ds-ease: .16s ease`.

## 6. Voice & content cues

- Philosophy repeated everywhere: **Hypothesis → Experiment → Evidence → Decision → Next step**; "AI drafts → Founder reviews → Founder approves".
- Honest evidence language: interest ≠ buying intent; progress measured by market outcomes, "not by clicks, streaks, or completed lessons".
- Placeholders are shown as bracketed muted text (`[Your riskiest assumption]`) — content is clearly illustrative.

## 7. Takeaways for Orbit GTM Studio

Adopt the *family resemblance*, not the brand:

1. Off-white green-tinted canvas, near-black ink, a single electric-green accent used **only as a fill behind dark text** or on dark backgrounds; a darker green (`#007a2f`-range) for green text on light.
2. Grotesk display + neutral sans body; uppercase tracked micro-labels for statuses.
3. Hairline-bordered cards without shadows, 16px radius, 44px controls, pill buttons.
4. Explicit, honest status vocabulary — and our own rule from the spec: nothing is ever auto-labelled "validated".
5. Working UI ≠ landing page: drop the continuous orbit animation, scroll reveals and dashed rotated chips inside the app (owner asked for no continuous motion in the working interface). Keep one authored moment on the welcome page.

Do **not** reuse: the Black Orbit / Founder Orbit name or logo, its orbit illustration, page copy, section structure, or font files fetched from their site (we load our own fonts from Google Fonts / `next/font`).
