# Orbit GTM Studio — Craft Playbook (v4)

The working contract for the v4 rebuild: what we do, what we refuse, and the vocabulary we use to be precise. Every screen in all three UI versions is checked against this document before it is called done.

Written 2026-10-17 after a review of the shipped v3 UI, the owner's reference projects (CampusLense, Compass, inVision U) and the sources listed at the end.

---

## 0. Diagnosis of v3 (why the owner rejected it)

| Symptom | Root cause | v4 answer |
| --- | --- | --- |
| "Small rows and columns that the AI fills" | Output rendered as form fields; analysis never became an *argument* | Every AI or rule output is rendered as a **visual model** (matrix, ladder, map, scorecard) with its reasoning one click away |
| Founders asked to fill fields *after* the analysis | Questions surfaced from the run instead of the intake | **Ask before, assume after.** Intake asks ≤7 questions; afterwards the system states the assumptions it made and the founder confirms or edits |
| Disharmony, imbalance | Many card styles, neon plates, mixed radii, eyebrow labels everywhere, dark-by-default without reason | One primitive per version, one accent, one radius scale, no eyebrows, light/dark chosen by use scene |
| Bare-minimum depth | Completion = 5 booleans; dashboard = counts | A transparent **insight engine**: readiness radar, assumption map, channel bullseye, evidence ladder, positioning canvas, sizing scaffold, week load |
| Black-hole hero: "angle and execution limp" | A lit planet + flat ring, camera too frontal | Lensed accretion disk (Schwarzschild approximation), camera ~8° above the disk plane so the far side of the disk arches over the shadow ("Gargantua hat"), Doppler beaming on the approaching side |
| English only | — | EN / RU / KK, server-rendered, `<html lang>` correct, Cyrillic-capable type stack |

---

## 1. Brand inputs (only colours and fonts from blackorbit.site)

Measured on blackorbit.site (computed styles, 2026-10-17):

| Token | Dark | Light |
| --- | --- | --- |
| page | `#07090a` | `#f4f7f4` |
| surface | `#101412` | `#ffffff` |
| surface-subtle | `#161b18` | `#f4f6f4` |
| line | `#28332d` / `#2a312c` | `#cfdad2` / `#d7dcd8` |
| text | `#f4f7f5` | `#06120a` |
| muted | `#aab6af` → `#8b938c` | `#46564c` → `#5c635e` |
| accent | `#00ff5a` (signal) · `#20fa80` | `#12d66a` fill · **`#007a2f` for green text** (contrast) |
| accent-mint | `#7dffb6` | `#3ee089` |
| on-accent | `#04140c` | `#04140c` |

Type on the reference: **Space Grotesk 700, tracking −0.02em** for headings; **Montserrat** for body.

**Coverage check (done):** Space Grotesk ships Latin/Latin-Ext/Vietnamese only — **no Cyrillic**. Russian and Kazakh (ә ғ қ ң ө ұ ү һ і) therefore fall back, per glyph, to **Montserrat Variable** (cyrillic + cyrillic-ext). This is declared, not accidental: `font-family: "Space Grotesk Variable", "Montserrat Variable", sans-serif`.
Data, measurements and IDs use **JetBrains Mono Variable** (has Cyrillic) — mono only for numbers, units, codes and timestamps, never as a "technical costume".

Rules: `font-variant-numeric: tabular-nums` on every number that can change; `text-wrap: balance` on headings, `pretty` on paragraphs; body measure 60–75ch; tracking floor −0.03em.

---

## 2. Refuse list (anti "vibe-coded" tells)

Reaching for any of these while the axis is free means we were not deciding.

**Layout**
- Eyebrow/kicker label above every heading. (Banned. The heading carries itself.)
- Centered hero over a dark mesh; badge pill above the H1.
- Three equal icon-on-top feature cards; nested cards; "bento" as filler.
- Hero-metric template (big number + small label + 3 stats) used as content.
- Section numbers 01/02/03 unless the sequence carries information (the GTM chain does — the landing does not).

**Surface**
- Gradient text; purple/blue glows; zero-offset coloured halos; glassmorphism as decoration.
- Coloured `border-left` stripes on cards/alerts.
- Mixed radii. (Scale: 4 / 8 / 14 / pill. Cards ≤14px.)
- A 1px border *and* a wide soft shadow on the same card ("ghost card"). Declare elevation once.
- Sparklines/progress rings standing in for content. A ring must encode a real ratio and be labelled.
- Emoji or Unicode glyphs as icons. One icon family (Lucide, stroke 1.75), one stroke width.

**Motion**
- One identical fade-up on every section ("scroll-reveal wallpaper").
- `transition: all`; animating `width/height/top/left`; `scale(0)` entrances; `ease-in` on entrances.
- Animating keyboard-initiated, high-frequency actions (command menu open, tab switching by key).
- Infinite decorative loops in the working UI (the landing scene is the one authored exception and pauses off-screen).

**Copy & data**
- "Validated", "proven", "AI-powered insights" for anything untested. Assumptions stay assumptions.
- Placeholder numbers presented as data. Illustrative values are labelled *illustrative*.
- Asking the founder to fill a form after an analysis ran.

---

## 3. Do list

- **One authored moment per screen** (Impeccable "craft floor"): the landing's black hole, the overview's orbit assembling, the dashboard's matrix plotting. Everything else is productive motion.
- **One primitive per version, repeated as signature** (see §5).
- **Theme the browser surfaces**: `::selection`, caret colour, focus ring (2px accent, 2px offset), scrollbars, underline offset, tabular numerals.
- **States everywhere**: loading (skeleton matching the final layout), empty (explains what will appear and the one action that fills it), error (names problem + recovery), saving/saved, conflict.
- **Progressive disclosure**: overview → model → reasoning → source. Each visual answers "what is compared to what?" (Tufte).
- **Data-ink**: remove gridlines and boxes that carry no data; label directly on the mark instead of legends where possible; small multiples over one overloaded chart.
- **Explainability**: every score shows its formula and inputs on demand ("why 62?"). Rule output and AI output are visually distinguished (`rules` vs `AI` provenance chip).

---

## 4. Motion system

Vocabulary (Emil Kowalski / Carbon / Material): *productive vs expressive motion, orchestration, stagger, cascade, continuity transition, shared-element (container) transform, origin-aware animation, interruptibility, spring (duration + bounce), reveal (clip-path/mask), crossfade with blur bridge, reduced-motion fallback.*

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | entrances, feedback (default) |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen movement/morph |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | drawers, sheets |
| `--ease-exit` | `cubic-bezier(0.4, 0.14, 1, 1)` (Carbon expressive exit) | elements leaving permanently |
| `--dur-press` | 120ms | `:active` scale 0.97 |
| `--dur-fast` | 160ms | hover, tooltip, toggles |
| `--dur-base` | 240ms | popovers, panels, tab content |
| `--dur-slow` | 420ms | route continuity, large expansions |
| `--dur-hero` | 900–1400ms | the one authored moment |
| stagger | 40–60ms, capped at 8 items | lists that read as lists |
| spring (UI) | `{ type: "spring", duration: 0.45, bounce: 0.12 }` | layout, drag, shared elements |

Rules:
1. Should it animate? Frequency decides (100+/day → never).
2. Exits are faster than entrances (~70%).
3. Entrances start from an already-visible state (opacity 0→1 with ≤12px translate or scale ≥0.96), never from nothing.
4. Hierarchy: primary element first, supporting elements follow; read as one motion.
5. Interruptible: CSS transitions or springs for anything user-triggered; keyframes only for one-shot authored moments.
6. Only `transform`, `opacity`, `clip-path`, `filter` (blur ≤ 8px); never layout properties.
7. `prefers-reduced-motion` and the workspace "reduced" preference → crossfades only, the hero renders one still frame.

---

## 5. Three versions (same product, same data, three design reads)

All three share brand colours, type stack, i18n, the insight engine, data and routes required by the brief. They differ in concept, composition, navigation, density and motion. Switch with the **UI** control in any header or `?ui=observatory|ledger|flow` (stored in a cookie, rendered on the server).

### V1 · Observatory — "the startup as a body in orbit"
*Design read:* founder workspace for early-stage teams, instrument-panel language, dark by default (night work, focus), density 7/10, motion 6/10.
- **Primitive:** the *readout* — a hairline-framed instrument cell with a mono label, a big tabular value and a one-line meaning. Repeated for every metric.
- **Navigation:** left vertical rail with the orbit dial (sections ring + 30-day ring) as the home control.
- **Signature visuals:** orbit dial, readiness radar, channel bullseye (Weinberg's rings), assumption field (importance × evidence).
- **Motion:** radial reveals, scanline sweep on load, rings drawing with `stroke-dashoffset`; the landing black hole.

### V2 · Ledger — "the GTM strategy as a living dossier"
*Design read:* investor-grade document, editorial field-sheet language, light paper by default (reading, printing, sharing), density 5/10, motion 3/10.
- **Primitive:** the *ruled entry* — a full-width row on hairline rules: term on the left column, statement in the measure, provenance and evidence in the margin (footnote markers like CampusLense's photo passport).
- **Navigation:** top bar + table of contents with scroll-spy; the dossier reads top to bottom: Profile → Five decisions → Models → Plan.
- **Signature visuals:** small multiples, evidence ladder, margin notes, positioning statement typeset as a sentence with filled/missing slots.
- **Motion:** line-by-line text reveal (mask), ink underline draws for links/state, no parallax.

### V3 · Flow — "Hypothesis → Experiment → Evidence → Decision → Next step"
*Design read:* operator board for doing the work this week, systems-diagram language, dark neutral (works both), density 6/10, motion 7/10.
- **Primitive:** the *node* — a compact block with a status port; nodes connect with drawn edges.
- **Navigation:** horizontal stage bar (the Black Orbit loop) at the top; the overview is a node graph from ICP → Value → Channels → Pricing → Assumptions → Experiments → Evidence.
- **Signature visuals:** the dependency graph, week swimlanes, critical-path highlight, decision log.
- **Motion:** container transform (node expands into its editor), edges draw on (`pathLength`), spring layout when tasks move between lanes.

---

## 6. The "brain": methodology wired into rules and agents

Rule engine (deterministic, always on, labelled `rules`):

| Model | Method | Inputs → output |
| --- | --- | --- |
| Readiness radar | Specificity heuristics per decision | ICP, value, channels, pricing, assumptions, plan progress → 0–100 per axis with reasons (named role? number? geography? trigger? measurable threshold?) |
| Assumption map | Bland's *Assumptions Mapping* (importance × evidence; desirability / viability / feasibility) | risk rating + keyword lens + linked task outcomes → position, quadrant, "test first" |
| Channel bullseye | Weinberg & Mares *Traction* (19 channels, three rings) + ICE score | chosen channels, model, stage, market → ring, ICE with formula, local (Kazakhstan/CA) notes |
| Evidence ladder | Commitment ladder: opinion → interest → meeting → LOI → deposit → paid pilot → repeat purchase | done tasks + recorded observations → highest reached rung; never auto-"validated" |
| Positioning canvas | Dunford's five components (alternatives, unique attributes, value, best-fit customers, category) | ICP/value fields → filled vs missing slots |
| Sizing scaffold | Bottom-up TAM/SAM/SOM = accounts × ARPA × frequency | parsed price + founder counts; unknowns stay unknown |
| Plan load | Weekly capacity vs tasks | tasks per week, done ratio, current day |

AI specialists (owner-gated, labelled `AI`): the six-role council keeps its contracts and adds structured **insights** — personas with jobs-to-be-done, positioning, channel scoring, market sizing inputs with sources, price anchors and a willingness-to-pay test (Van Westendorp questions). Research breadth rises (more searches, more captured pages, required coverage: direct competitors, substitutes and do-nothing, pricing pages, market statistics, communities/channels, local purchasing/regulation). Questions are asked by the intake *before* specialists run; after a run the UI shows "assumptions the team made", never a form.

---

## 7. Self-review gate (run before calling anything done)

1. Does every screen have one clear primary action and one authored moment, no more?
2. Remove one wrapper per section — does it still read? Then remove it.
3. Any eyebrow, gradient text, coloured stripe, ghost card, emoji, `transition: all`? Delete.
4. All numbers tabular; all scores explain themselves; all illustrative values labelled.
5. Loading, empty, error, saving, conflict states present and reachable.
6. EN/RU/KK: no overflow at 375px; Cyrillic headings render in Montserrat, not a system fallback.
7. Keyboard: focus visible on every control; Esc closes overlays; no motion on key-initiated actions.
8. Reduced motion: no translate/scale; hero still frame.
9. Contrast: body ≥ 4.5:1, large ≥ 3:1; green text on light uses `#007a2f`.
10. The brief's journey (create → profile → five sections → dashboard → roadmap → status → refresh) works end to end in each version.

---

## Sources

- Emil Kowalski, "Great animations" — https://emilkowal.ski/ui/great-animations and the `emil-design-eng` skill (local `1AAA_AI_DEV_TOOLS/SKILLS/design_skills/packages/emil-kowalski`).
- Rauno Freiberg, "Invisible details of interaction design" — https://rauno.me/craft/interaction-design
- IBM Carbon motion (productive/expressive, duration tokens) — https://carbondesignsystem.com/elements/motion/overview/
- Impeccable "craft floor" (local `packages/impeccable/reference/craft-floor.md`) and Taste skill (local `packages/taste-skill`).
- AI design slop patterns — https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it ; https://thecrit.co/resources/vibe-coding-design-guide ; https://designcode.io/articles/avoid-ai-slop-vibe-coded-landing-pages
- Opus 5.5 motion workflow notes (community, unverified) — https://charliehills.substack.com/p/opus-55-motion-graphics ; https://aiidelist.com/blog/opus-5-5-motion-design
- Tufte / Few on data-ink, sparklines and small multiples — https://faculty.cc.gatech.edu/~stasko/4460/Notes/tufte.pdf
- David Bland, Assumptions Mapping — https://strategyzer.com/library/how-assumptions-mapping-can-focus-your-teams-on-running-experiments-that-matter
- Bullseye framework (Traction) — https://resources.rework.com/libraries/growth-frameworks/bullseye-framework ; https://grahammann.net/book-notes/traction-gabriel-weinberg
- April Dunford positioning components — https://readingraphics.com/book-summary-obviously-awesome/
- Bottom-up market sizing — https://www.salesforce.com/blog/tam-sam-som/
- Black hole rendering references — https://discourse.threejs.org/t/gargantua-a-ray-traced-black-hole-in-my-portfolio-webgl-one-draw-call/94960 ; https://jasperbernaers.com/black-hole-visualizer/
- Kaspi merchant scale (self-reported) — https://digitalbusiness.kz/2025-12-31/mihail-lomtadze-podvel-itogi-goda-i-poobeshchal-chto-kaspi-kz-prodolzhit-udivlyat-v-2026-m/
- Owner's reference projects: github.com/Eye172/campuslense-showcase, /decentrathon5-project-v2, /impact-hackathon-2.
