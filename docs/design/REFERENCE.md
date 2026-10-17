# Visual reference — Black Orbit (blackorbit.site)

Owner: Claude · Captured 2026-10-16 from https://www.blackorbit.site (page title "Founder Orbit | Commercialization Intelligence"), live browser, viewport ≈780 px wide plus computed-style and stylesheet inspection.

Purpose: understand the visual language of the ecosystem so Orbit GTM Studio feels like a sibling product **without copying** Black Orbit's page, code, copy, logo or illustrations. Everything below is observation; what we adopt is decided in [SPEC.md](SPEC.md).

17 October owner override: the owner explicitly requested the original website logo. The shared header now uses the original PNG wordmarks rather than the approximate SVG, with an independent GTM Studio label. This supersedes the historical logo-exclusion notes below, in SPEC.md and REMAKE.md. The official page's header image and theme switch were inspected directly; the existing local PNGs were confirmed byte-identical to the current source assets:

- [White wordmark for dark backgrounds](https://www.blackorbit.site/brand/logo-light.png), local public/brand/blackorbit-logo-light.png, SHA-256 `fed9d2d7157c1ef5ed58a393bf54a4e0ea721484a8be51de5047aaf5c9721624`.
- [Black wordmark for light backgrounds](https://www.blackorbit.site/brand/logo-dark.png), local public/brand/blackorbit-logo-dark.png, SHA-256 `640e2299209662d50289f07358acb2ace4aca813825af2764127758b675be191`.
- [Official favicon](https://www.blackorbit.site/favicon.svg), copied to public/icon.svg.

Images are served locally without altering their pixels. Theme tokens select the appropriate asset; the welcome hero always uses the white wordmark. On narrow workspace headers, CSS clips the same image to its left symbol so navigation controls remain available. The home link retains its full accessible product name.

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
5. Working UI ≠ landing page: drop the continuous orbit animation, scroll reveals and dashed rotated chips inside the app (design judgment; the lead's brief relayed "avoid continuous animation in the working interface". See MOTION.md for the corrected attribution). Keep one authored moment on the welcome page.

Do **not** reuse: the Black Orbit / Founder Orbit name or logo, its orbit illustration, page copy, section structure, or font files fetched from their site (we load our own fonts from Google Fonts / `next/font`).

---

# Beyond Black Orbit — creative and practical references (owner request, issue #1)

Captured 2026-10-16. Goal: avoid another template; find purposeful, unusual composition that still passes a cold usability check.

## A. Owner-supplied reference

- **Instagram post `DL_KH_Cvie4` (uiuxbunker, credit @bachynskyi_ui, "UI/UX Product Design" reel)**. Without logging in, only the post's cover frames are visible. Slide 8 (a video) could not be viewed, so this note is based on the cover frame. Observed: rectangular **screen plates** (tablet/phone slabs, rounded, thick edges) floating at different tilts around a **glass orbit ring**, with one dark hero plate in the middle. Monochrome pink set, soft studio light. Takeaway: interface as a set of physical, separable plates arranged in space; one plate is dominant, the rest orbit it. This matches our product's name and the ecosystem's "orbit" metaphor.

## B. The owner's own interfaces (`.codex/research/`, local screenshots)

| Screen | What works (keep the idea, not the look) |
|---|---|
| Agent Deck | Mixed styles: a skeuomorphic **device plate** (bezel, screen, knob, power button) next to flat editorial type. One object carries the personality; the rest stays calm. |
| WhiteBox Studio | Dark operational app. A sticky **"Quick check" side plate** with live counts ("Criteria covered 4 of 4") and segmented readiness bar. Blocks reorder with **explicit ↑ / ↓ buttons** next to a drag handle. |
| SearchiousAI | Canvas with a minimap and a **keyboard legend bar** (pan, zoom, fold shortcuts) that is always visible. Canvas used only where the content really is spatial. |
| inVision U | Numbered stepper with done/current/next states, then a **timeline chart** of events, neon lime on near-black, mono micro-labels ("ШАГ 2 / 4", "✓ минимум достигнут"). Shows the rule ("at least 7 events, 1 failure") together with whether it's met. |
| CampusLense | Editorial profile: large name, fact row (city, founded, students, site), a photo bento, and a narrow **facts rail** on the right. Lots of white space; quiet type. |

Pattern across the owner's work: **one characterful object per screen, calm everything else, live "rule + status" readouts, keyboard-visible affordances, explicit move buttons**.

## C. Platform patterns for movable plates

| Source | Pattern | Usability lesson |
|---|---|---|
| iOS / iPadOS Home Screen widgets | Edit mode ("jiggle") is entered on purpose; widgets come in fixed sizes S/M/L; Done exits; a hidden-widget gallery restores items. | Separate **edit mode** from use mode; fixed sizes only; easy restore. |
| Android launcher widgets | Grid-snapped resizing with handles; items reflow. | Snap to a grid; never free pixel positioning. |
| macOS widgets / Notification Center | "Edit widgets" sheet, add/remove from a gallery, order by drag. | Hidden-items tray instead of deleting. |
| GitHub profile "Customize pins" | Drag to reorder with keyboard alternative; capped count. | Cap the number of items; keyboard path is required. |
| Atlassian Pragmatic drag-and-drop guidance / dnd-kit | Drag handles + a menu or button alternative for every drag action; live-region announcements ("moved to position 3 of 7"). | Drag is an enhancement; **buttons are the baseline**. |
| Grafana / Datadog dashboards | Freeform panel grids get messy; "reset to default" and saved layouts are essential. | Always provide **Reset layout**; keep a curated default. |
| Linear / Raycast | Calm surfaces, dense, keyboard-first, shortcut hints shown inline. | Show shortcuts where the action is. |
| Windows Snap Layouts | A few predefined layouts instead of free placement. | Offer **presets** rather than unlimited freedom. |
| Teenage Engineering product pages | Hardware panels: labelled modules, readouts and controls on separate plates. | "Instrument" metaphor fits status readouts, but only for measured values. |

## D. Cold evaluation of candidate ideas

| Idea | Benefit | Usability risk | Verdict |
|---|---|---|---|
| Plates arranged around a 3D orbit (as in the reel) inside the app | Memorable | Tilted text hurts readability, spatial nav is slow, poor on mobile | **Welcome page only**, flat 2.5D, static, decorative |
| Freeform canvas for strategy forms | Feels creative | Forms need linear order, focus order breaks, mobile unusable | **Rejected** (design judgment; later echoed by the lead) |
| Reorderable dashboard plates in edit mode | Personal, matches founder priorities | Drag-only is inaccessible; dense packing breaks focus order | **Adopted** with move buttons, keyboard drag, fixed sizes, no dense packing, reset |
| One dark "instrument plate" per screen (mixed style) | Clear focal readout, ecosystem flavor | Too many dark blocks = noise | **Adopted**, max one per screen |
| Mono type for readouts and key hints | Precise, owner's taste | Mono as decoration = costume | **Adopted for numbers, codes, shortcuts only** |
| Asymmetric grid with intentional empty columns | Calm, editorial, breathing room | Wasted space on small laptops | **Adopted ≥1280 only**; collapses at 1024 |
| Timeline lanes for the 30-day roadmap | Time is actually spatial here | Horizontal scroll on mobile | **Adopted on desktop**; vertical timeline on mobile |
| Rotated/tilted chips in the working UI | Playful | Harder to read, looks messy | **Rejected** in the app |
