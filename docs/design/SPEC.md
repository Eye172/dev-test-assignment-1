# Frontend design specification — Orbit GTM Studio

Owner: Claude (design) · Implementer: GPT (lead) · Status: proposal for lead review · 2026-10-16

Evidence base: [REFERENCE.md](REFERENCE.md). Data/API truth: [../CONTRACT.md](../CONTRACT.md) — this spec never changes the contract; where a UI idea needs data the contract lacks, it is marked **(needs contract)** and is optional.

## 0. Direction in one paragraph

A calm, precise **working tool** that is visibly a sibling of Black Orbit: off-white green-tinted canvas, near-black ink, one electric-green accent, hairline cards, pill controls, honest status words. It is an *Operate* surface, so familiarity beats flourish: one sans for UI, a grotesk only for titles and key numbers, motion only to confirm state. The founder can start anywhere, save half-finished thoughts, and always sees what is complete, what is missing and what to do next. Nothing is ever presented as "validated" unless the founder says so.

**Composition idea (owner request, issue #1): "Orbit plates."** Every screen is built from a small set of distinct **plates**: physical-feeling, separable panels placed on an asymmetric grid with deliberate empty space. This takes the reel's floating screen plates and the owner's own device-plate and quick-check patterns (see REFERENCE.md "Beyond Black Orbit"). Plates come in three materials, so styles are mixed on purpose but kept under control. Plates move only where moving helps: the dashboard is customizable, and forms never turn into a canvas. See §3A.

Owner priorities mapped: **simple** (one primary action per screen), **customizable** (theme, density, motion, accent, custom channels/tasks), **adaptive** (desktop sidebar ↔ mobile bottom nav), **fluent motion** (short, interruptible transitions), **keyboard/touch accessible** (44px targets, visible focus, shortcuts), **convenient** (deep links to missing fields, save-state always visible, copy link, export).

---

## 1. Design tokens

Implement as CSS custom properties on `:root` with `[data-theme]`, `[data-density]`, `[data-motion]`, `[data-accent]` attributes on `<html>` set from saved preferences (server-rendered to avoid a flash). `theme: system` → no `data-theme`, use `prefers-color-scheme`. All pairs below were contrast-checked (ratios in brackets).

### 1.1 Color — light (default)

```css
:root {
  --bg: #f4f7f4;            /* page */
  --surface: #ffffff;       /* cards, inputs */
  --surface-2: #eaf0eb;     /* sidebar, toolbars, selected rows */
  --ink: #06120a;           /* text [17.7 on bg] */
  --muted: #46564c;         /* secondary text [7.2 on bg, 6.7 on surface-2] */
  --line: #cfdad2;          /* decorative hairlines only */
  --line-strong: #7d8c82;   /* input borders, unchecked controls [3.5 on surface] */

  /* accent (green default) */
  --accent: #00ff5a;        /* FILL ONLY — never text/icons on light [1.26 on bg] */
  --on-accent: #04140c;     /* text on accent [13.9] */
  --accent-ink: #007a2f;    /* green text/links/progress fill on light [5.1 on bg, 5.5 on white] */
  --accent-soft: #d9fbe5;   /* tinted backgrounds; text on it = --ink or #005c23 [7.4] */

  --info: #1f55d6;  --info-soft: #e6eeff;   /* "in progress" [6.3 on white] */
  --warn: #8a5a00;  --warn-soft: #fdf1d8;   /* medium risk, unsaved [5.9 on white] */
  --danger: #b42318; --danger-soft: #fdecea; /* errors, high risk [6.6 / 5.8] */

  --focus: #06120a;         /* focus ring on light */
  --scrim: rgb(6 18 10 / 0.4);
}
```

### 1.2 Color — dark

```css
[data-theme="dark"] {
  --bg: #070807; --surface: #101412; --surface-2: #161b18;
  --ink: #f5f7f5;           /* [18.6] */
  --muted: #97a098;         /* [6.5 on surface-2] */
  --line: #2a312c; --line-strong: #66726a;  /* [3.7 on surface] */
  --accent: #20fa80; --on-accent: #04140c;
  --accent-ink: #20fa80;    /* accent is legible as text on dark [13.3] */
  --accent-soft: rgb(32 250 128 / 0.12);
  --info: #8fb3ff; --info-soft: rgb(143 179 255 / 0.12);
  --warn: #e3b45c; --warn-soft: rgb(227 180 92 / 0.12);
  --danger: #ff7a6b; --danger-soft: rgb(255 122 107 / 0.12);
  --focus: #20fa80;
}
```

### 1.3 Accent preference (`data-accent`)

| Accent | `--accent` fill | `--on-accent` | `--accent-ink` light / dark | `--accent-soft` light |
|---|---|---|---|---|
| green (default) | `#00ff5a` / dark `#20fa80` | `#04140c` | `#007a2f` / `#20fa80` | `#d9fbe5` |
| lime | `#c8f53c` | `#06120a` [15.1] | `#4a6b00` [6.2] / `#c8f53c` | `#f1fcd0` |
| blue | `#7aa7ff` | `#06120a` [8.0] | `#1f55d6` [5.9] / `#8fb3ff` | `#e6eeff` |

Accent is used **only** for: the primary button, current navigation item indicator, progress fills, the "complete" marker, and the brand mark's launch dot. Never for decoration or inactive states.

### 1.4 Typography

Fonts via `next/font/google` (self-hosted at build, no runtime requests to Black Orbit): **Space Grotesk** 600/700 for h1–h3 and large numerals; **Inter** 400/500/600 for everything else. `font-variant-numeric: tabular-nums` on all percentages, counts, dates.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--t-display` | `clamp(2.5rem, 6vw, 4.25rem)` / 1.02, tracking -0.03em | SG 700 | Welcome headline only |
| `--t-h1` | 2rem / 1.15, -0.02em | SG 700 | Page titles |
| `--t-h2` | 1.5rem / 1.2, -0.015em | SG 600 | Section titles |
| `--t-h3` | 1.125rem / 1.35 | Inter 600 | Card / field-group titles |
| `--t-body` | 1rem / 1.55 | Inter 400 | Body, inputs (≥16px prevents iOS zoom) |
| `--t-small` | 0.875rem / 1.45 | Inter 400/500 | Help text, meta |
| `--t-label` | 0.75rem / 1.2, +0.08em, UPPERCASE | Inter 600 | Status tags, eyebrow-free micro labels |
| `--t-stat` | 2.5rem / 1, -0.02em | SG 700 | Progress % |

App pages use fixed rem sizes (no fluid type) except the welcome display line. Prose measure ≤ 68ch. No eyebrow labels above headings.

**Mono, for measurement only:** **JetBrains Mono** 500 (`--font-mono`) for readout numbers inside instrument plates, keyboard shortcut hints, rule keys in "Why this task", and day ticks on the roadmap timeline. Never for labels, headings or body.

### 1.5 Space, shape, elevation

- Spacing: `4 8 12 16 24 32 48 64 96` (`--s-1 … --s-9`).
- Radius: `--r-sm 8px` (inputs, chips), `--r-md 14px` (cards), `--r-pill 999px` (buttons, tags, toggles).
- Elevation: **border only** (1px `--line`) for cards. A shadow is used only for floating layers (popover, toast, mobile bottom sheet): `0 8px 24px rgb(6 18 10 / 0.12)` with no border.
- Control height: `--control-h: 44px` comfortable / `36px` compact. On `(pointer: coarse)` it stays 44px regardless of density.
- Container: max 1200px; gutters 16px (<600), 24px (<1024), 32px.

### 1.6 Motion

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --d-press: 100ms; --d-fast: 160ms; --d-base: 220ms; --d-progress: 450ms;
}
```

Rules: animate `transform`, `opacity`, `background-color`, `clip-path` only, with explicit property lists (never `transition: all`). Everything is interruptible CSS transitions, not keyframes. No continuous or looping animation anywhere inside `/startups/**`. No artificial delays — a save shows "Saving…" only for as long as the request takes.

Reduced motion = OS `prefers-reduced-motion: reduce` **or** preference `motion: reduced` (`[data-motion="reduced"]`): all durations → `0.01ms` except opacity fades (kept at 120ms, no movement); smooth scrolling off.

---

## 2. Brand

- Name: **Orbit GTM Studio** (wordmark: "Orbit GTM" in SG 700 + " Studio" in Inter 500 muted).
- Mark: [`mark.svg`](mark.svg) — original. An open orbit (310° ring, gap in the upper-right), a solid core (the market) and a launch dot leaving orbit through the gap (go-to-market). Uses `currentColor` for ink and `--mark-accent` for the dot. Works at 16px. Favicon = same SVG.
- Does not reuse the Black Orbit logo, orbit diagram or copy.

---

## 3A. Composition system — plates

### Materials (max one instrument plate per screen)

| Material | Look | Used for |
|---|---|---|
| **Paper plate** (default) | `--surface`, 1px `--line`, radius 14, no shadow | Content, forms, lists: almost everything |
| **Instrument plate** | Always dark, in both themes: body `#0b100d`, 1px inner hairline `#222a25`, radius 18, an inset "screen" area `#111813` with 12px padding; text `#eef2ef` [17:1], muted `#8f9a92` [6.2–6.6:1]; readouts in `--font-mono` and the dark-theme accent value (every accent passes ≥7.5:1 on the plate) | The single most important live readout of a screen: strategy %, roadmap progress, completeness. Takes the role of the device plate in the owner's Agent Deck |
| **Signal** | Accent fill pill or dot with `--on-accent` text | Primary action, "complete" markers, the mark's launch dot. Never a whole surface |

In dark theme the instrument plate goes to `#000` with a `--line` hairline so it still reads as a separate object.

### Grid and free space

- Desktop ≥1280: 12-column grid, 24px gutters, max 1200px. Plates span **S = 4, M = 6, L = 8, XL = 12** columns. Rows fill in DOM order (`grid-auto-flow: row`, **never `dense`**), so visual order = reading order = focus order. A row that doesn't fill stays empty on purpose; that is the deliberate free space.
- 1024–1279: 12 columns, but S and M → 6 and L and XL → 12.
- 768–1023: 2 columns of 6. <768: one column; every plate is full width in the same order. Layout never depends on content height.
- Spacing between plates is 24px (16px under 768). Inside a plate: 24px padding (16px under 600).

### Plate anatomy

Header row: title (Inter 600, 15px) · optional live meta on the right (e.g. "Saved 14:02", "3/5") · optional action icon button. Body. Optional footer link ("Open roadmap →"). One plate never contains another plate. Inner groups use dividers or `--surface-2` wells.

## 3. App shell & navigation

### 3.1 Global header (all routes, sticky, 64px)

`[mark + wordmark → /]` · spacer · `[Demo mode tag]` · `[Preferences button]`.
Background `--bg` at 88% + `backdrop-filter: blur(12px)`, 1px bottom `--line`. Skip link "Skip to content" is the first focusable element.

**Demo mode tag** (pill, `--warn-soft` / `--warn` text, label "Demo mode"): opens a small popover: "No login. Data is synthetic and stored on our demo database. Anyone with a startup's link can view and edit it — don't enter sensitive information." Also shown as a one-line notice under the welcome CTA and on the new-startup form.

### 3.2 Startup workspace navigation (`/startups/:id/**`)

Four destinations: **Overview** (`/startups/:id`), **Strategy**, **Dashboard**, **Roadmap**.

- **≥1024px**: left sidebar 240px (`--surface-2`): startup name (2-line clamp) + stage tag, then the 4 nav items (icon + label, 44px rows; current = `aria-current="page"`, 3px accent-ink bar on the left edge *inside* the row radius + `--surface` background), then a compact progress block "Strategy 3/5 · Roadmap 4/9 done", then utility actions: Copy link, Export JSON.
- **600–1023px**: sidebar collapses to a horizontal tab bar under the header (sticky), same items, current item underlined 2px accent-ink.
- **<600px**: bottom navigation bar (64px + `env(safe-area-inset-bottom)`), 4 items icon-over-label, current item gets an accent pill behind the icon. Page content gets bottom padding so nothing hides behind it. Copy link / Export move into an overflow "⋯" button in the page header (drawn icon, not a glyph).

Route change: move focus to the page `<h1>` (tabindex -1) and announce the title via the live region.

### 3.3 Preferences (popover from header; bottom sheet on <600px)

Theme: System / Light / Dark (segmented). Density: Comfortable / Compact. Motion: Full / Reduced (plus note "Your system setting is always respected"). Accent: three swatches with names (green, lime, blue) as a radio group. Changes apply instantly and save to the startup's `preferences` via PATCH when inside a workspace; on `/` and `/startups/new` they apply locally until a startup exists, then are sent with creation. Esc closes; focus returns to the trigger.

---

## 4. Shared components

| Component | Spec |
|---|---|
| **Button** | Pill, `--control-h`, padding 0 20px, Inter 600 15px, sentence case. Variants: *primary* (accent fill, on-accent text), *secondary* (surface, 1px `--line-strong`), *ghost* (text only, hover `--surface-2`), *danger-ghost*. States: hover (primary: brightness via `filter: brightness(0.96)`; others: `--surface-2`), `:active` scale(0.98) `--d-press`, focus-visible ring, disabled (40% opacity + `cursor:not-allowed` + still focusable explanation via `aria-describedby` where the reason isn't obvious), loading (label swaps to verb-ing text, inline 14px spinner, `aria-busy="true"`, width locked to avoid layout shift). |
| **Focus ring** | `outline: 2px solid var(--focus); outline-offset: 2px;` on `:focus-visible` everywhere, including SVG/custom controls. Never removed. |
| **Text field / textarea** | Label above (Inter 500 14px), required marker "Required" in muted small text after the label (not a lone red asterisk), help text below, 16px input text, 1px `--line-strong`, radius 8, focus = 2px focus ring. Error: border `--danger`, message below with a drawn alert icon, `aria-invalid`, `aria-describedby` → help + error. Textareas auto-grow (min 3 rows, max 10) and show a character counter only past 80% of any limit. |
| **Segmented choice** | For B2B/B2C/B2G, stage, risk, theme: native radio inputs styled as pills in a row, wrapping on narrow screens; arrow keys move selection (native radio behavior). |
| **Select** | Native `<select>` styled to match fields (custom chevron icon). Used for pricing model and task status menus on mobile. |
| **Combobox for channels** | `<input list>` + `<datalist>` suggestions (Founder-led outreach, LinkedIn outreach, Cold email, Content / SEO, Communities, Partnerships, Events, Referrals, Marketplace, Paid ads) — free text accepted (custom channel names). |
| **Status tag** | Pill, `--t-label`, icon + word, never color alone. Section: *Complete* (accent-soft bg, check icon), *Draft* (warn-soft, half-circle icon), *Not started* (surface-2, empty-circle icon). Task: *To do* (surface-2), *In progress* (info-soft), *Done* (accent-soft, check), *Skipped* (surface-2, strikethrough title, skip icon). Assumption: always *Untested* (outline tag, flask icon) — see §5.4. Risk: *Low* (surface-2), *Medium* (warn-soft), *High* (danger-soft). |
| **Progress** | (a) **Segmented section bar**: 5 equal segments with 4px gaps, 8px tall, radius pill; complete = `--accent-ink` (light) / `--accent` (dark), draft = striped-free `--warn` at 35% opacity, not started = `--line`. Each segment has a visible label below on ≥600px and is a link to that section. `role="img"` + `aria-label="3 of 5 sections complete: ICP complete, Value complete, …"`. (b) **Linear bar** for roadmap (done / active tasks). Fill width transitions `--d-progress` `--ease-out`. |
| **Card** | Surface, 1px `--line`, radius 14, padding 24 (16 on <600). No nested cards — inner grouping uses dividers or `--surface-2` wells. |
| **Save-state indicator** | Fixed slot right of each section title, `aria-live="polite"`: *Not saved yet* · *Unsaved changes* (warn dot) · *Saving…* · *Saved · 14:02* (check, accent-ink) · *Couldn't save — Retry* (danger, Retry button). Cross-fade between states 160ms. |
| **Toast** | Bottom-center (bottom-right ≥1024), max 1 visible, auto-dismiss 5s (paused on hover/focus), never the only place an error appears. Enter: translateY(8px)+opacity → 0, `--d-base`. Used for: "Startup created", "Link copied", "Plan updated — 3 added, 5 kept, 1 archived". |
| **Inline alert** | For form-level/server errors: danger-soft bg, icon, title + recovery sentence + action. `role="alert"` only for errors raised by a user action. |
| **Skeleton** | `--surface-2` blocks matching final layout; a single 1.2s opacity pulse is allowed **only** while loading and disabled under reduced motion. |
| **Empty state** | Short sentence of what this area will show + the one action that fills it. No illustrations. |
| **Icons** | `lucide-react`, 1.75 stroke, 18/20px. No emoji or unicode glyphs as icons. |

Browser surfaces: `::selection { background: var(--accent-soft); color: var(--ink) }`, `caret-color: var(--accent-ink)`, `accent-color: var(--accent-ink)` for native checkboxes/radios, thin scrollbars tinted `--line-strong`, links underlined with `text-underline-offset: 3px`.

---

## 5. Screens

Every screen has: one `<h1>`, `<main id="content">`, a loading state (`loading.tsx` skeleton), an error boundary (inline alert + "Try again" + "Go to home"), and the workspace routes share a **not-found** view: "We couldn't find this startup. The link may be mistyped, or the demo database was reset." + [Create startup] [Open demo startup].

### 5.1 Welcome `/`

Purpose: understand in 10 seconds, act in one click.

- Layout ≥1024: two columns (copy 7/12, visual 5/12); <1024: stacked, visual below CTAs.
- **Headline** (display): "Turn a startup idea into a 30-day go-to-market plan." Lead (muted, 18px, ≤56ch): "Describe your startup, decide five GTM essentials, and get a transparent, rule-based action plan you can track. No AI guesswork — every task explains why it's there."
- **CTAs**: primary "Create startup" → `/startups/new`; secondary "Explore demo startup" → `POST /api/demo` then navigate to the returned `/startups/:id` (button shows "Opening demo…" while pending; on failure inline alert "Couldn't open the demo. Retry").
- Under CTAs, small muted line: "Demo mode · no login · synthetic data".
- **Visual: "plates in orbit"** (our flat version of the owner's reel). A thin elliptical ring (1px `--line-strong`) around the mark's core. Five small paper plates sit on the ring, one per GTM section (ICP, Value, Channels, Pricing, Assumptions). Each is a 120×76 rounded slab with a section name and a tiny filled/empty marker, tilted only by `rotate(±3–6deg)` with a soft offset shadow (the only shadows on the page). One instrument plate in front reads `30-DAY PLAN · 8 TASKS` in mono. It is pure CSS/SVG, no 3D library, with text kept horizontal-ish so it stays legible. **The app's one authored motion moment**: on first paint the plates settle from 8px lower and 0 opacity, staggered 40ms, 500ms `--ease-out`. The launch dot then travels the ring and exits through the gap (700ms, once). Nothing loops. Under reduced motion it renders the final state. Decorative → `aria-hidden`. Under 1024: the ring is dropped and the plates become a horizontal, swipeable row of mini plates under the CTAs, with the instrument plate first.
- **How it works** (below fold, 3-step horizontal sequence, numbers allowed because order matters): 1 Profile — "Who you are and who you sell to." 2 Strategy — "ICP, value proposition, channels, pricing, assumptions. Save drafts in any order." 3 Plan — "A 30-day roadmap generated by visible rules. Track status as you go."
- **Honesty strip**: "What this is / isn't" two short lists — is: a structured workspace, rule-based plan, shareable link; isn't: AI strategy generator, validation proof, Black Orbit product.
- Footer: "Independent prototype for the AI Startify ecosystem · synthetic data".

### 5.2 New startup `/startups/new`

- Single column, max 640px, page title "Create your startup", one-line intro.
- Field order (matches mental model): Startup name · Short description (textarea, help: "One or two sentences: what you do and for whom.") · Business model (segmented B2B/B2C/B2G) · Stage (segmented Idea/MVP/Early Traction) · Target country or market · Primary customer segment (help example: "Operations managers at mid-size logistics companies") · Website (optional, `type="url"`, `inputmode="url"`, placeholder `https://`, accept bare domains by prefixing `https://` on blur — show the normalized value).
- Disclosure "Add more context (optional)" → context textarea. Custom fields are not shown on creation (available in profile edit) to keep the first form short.
- Validation: per field on blur after first edit; full on submit. On submit with errors: error summary box at top ("Please fix 2 fields") with anchor links, focus moves to the summary. Messages name the fix: "Enter a startup name", "Choose a business model", "Enter a valid URL, like https://example.com".
- Submit: primary "Create startup" (full width on <600). Pending: "Creating…", form `inert` but values kept. Success → navigate to `/startups/:id` + toast "Startup created". Server/network error → inline alert above the button with Retry; nothing is cleared. 422 field errors from the server map onto the same fields.
- Secondary link "Cancel" → `/`. If the form is dirty, confirm before leaving ("Discard this startup? Nothing has been saved yet.").

### 5.3 Startup overview `/startups/:id`

**Composition (≥1280):** row 1 = **identity plate** L(8): a large name (`--t-h1` at 2.5rem), description, and a fact row in CampusLense style (Model · Stage · Market · Segment · Website as label-over-value pairs) + **instrument plate** S(4): "Strategy" readout `40%` in mono, the 5-segment bar, and "Roadmap 4/9". Row 2 = **Next step plate** M(6) + **Roadmap snapshot plate** M(6). Row 3 = Profile details / edit plate L(8), with 4 columns of free space beside it. Under 1024 everything stacks in that order.

- **Header**: h1 = startup name; meta row of tags: business model, stage, market; website link (external icon, `rel="noopener"`). Actions: "Edit profile" (secondary), Copy link (ghost, toast "Link copied", fallback: select-able URL field if clipboard is denied).
- **Profile card**: description, customer segment, context, custom fields (key/value list). **Edit mode is inline** (the card turns into the same form as §5.2, plus custom fields editor with "Add field"), Save / Cancel; uses `expectedRevision`; 409 → conflict alert (§6).
- **Strategy progress card**: "2 of 5 sections complete" + `--t-stat` "40%", segmented bar (§4) with links; a "Continue strategy" primary button that deep-links to the first incomplete section.
- **Next step card**: one recommendation, derived from data in this priority: (1) a section with missing fields → "Finish *Pricing & Revenue*: add payment unit and rationale" [Open section]; (2) all complete but no roadmap → "Generate your 30-day roadmap"; (3) roadmap exists → next open task in the earliest week [Open roadmap].
- **Roadmap snapshot**: "4 of 9 tasks done" linear bar + the next 3 open tasks (title + week tag), or an empty state "No roadmap yet" [Generate roadmap] (enabled always; tooltip explains the plan adapts to whatever is saved).

### 5.4 GTM Builder `/startups/:id/strategy`

- **Section selection** is in the URL: `?section=icp|value|channels|pricing|assumptions` (default: first incomplete, else `icp`). Field deep link: `#field-<name>` scrolls to and focuses the field.
- **Not a canvas.** Forms stay linear and keyboard-ordered. The plate idea shows up as three fixed plates, which never move:
- **≥1280: three panes.** (1) **Section rail** (220px, sticky): a vertical "orbit rail" with 5 stations. Each station is a node on a thin line (filled accent = complete, half = draft, ring = not started), with the name and missing count ("2 missing"). Order is free; any station is clickable, so this is not a forced stepper. (2) **Editor paper plate** (flexible, max 720px). (3) **Quick-check instrument plate** (280px, sticky, owner's WhiteBox pattern): the section's required inputs as a live checklist (✓ met / ○ missing, each a link to its field), save state, and "Strategy 2/5" overall. The plate states the rule and whether it's met, e.g. "Complete when all 4 required inputs are filled · 3/4".
- **1024–1279:** rail + editor; the quick-check plate collapses into a compact strip at the top of the editor.
- **<1024:** a sticky, horizontally scrollable chip row of the 5 sections above the editor (current chip scrolled into view). Quick check becomes a **sticky bottom action bar** above the bottom nav: "1 missing · [Save section]", within thumb reach. Tapping "1 missing" jumps to the field.
- **Editor anatomy** (each section): h2 section name · one-line purpose (muted) · save-state indicator · fields · **"Required for Complete" checklist** (live, client mirror of the server rule; items link to fields; server response is authoritative) · Notes (optional, collapsible) · footer: [Save section] primary, [Next section →] ghost (after a successful save it becomes the emphasized action).
- Saving: explicit per-section Save (button, or ⌘/Ctrl+S when focus is inside the section). Draft saves are always allowed — incomplete sections save as *Draft*. Switching sections or leaving with unsaved changes → confirm "You have unsaved changes in *Value Proposition*" [Save and continue] [Discard] [Stay]. `beforeunload` guard while dirty. Failed save keeps the edits in the mounted form and shows *Couldn't save — Retry*.
- **Section content** (labels = founder language; contract keys in brackets):
  - **Ideal Customer Profile**: Buyer type [buyerType] (help: "Who signs or pays? e.g. Head of Operations") · Industry or demographics [industry] · Primary pain point [painPoint] · Buying trigger [buyingTrigger] (help: "What event makes them look for a solution now?").
  - **Value Proposition**: Customer problem [problem] · Promised outcome [outcome] · Differentiation [differentiation] · Proof or assumptions [proof] (help: "What evidence you have — or what you're assuming. It's fine to say 'assumption'.").
  - **Acquisition Channels**: 1–3 channel rows, each = Channel [name] (combobox) + Why this channel [reason]. "Add channel" (disabled at 3 with helper "Up to 3 channels — focus beats coverage."). Remove-row icon button on rows 2–3 (`aria-label="Remove channel 2"`; removing an unsaved draft row is immediate; removing a saved row happens on Save). First acquisition experiment [firstExperiment] (help: "Small, time-boxed, with a success criterion — e.g. 'Message 30 ops managers; success = 5 calls booked'.").
  - **Pricing & Revenue**: Pricing model [model] (select: Subscription, Usage-based, One-time, Freemium → paid, Paid pilot → contract, Commission / take rate, Other — "Other" reveals a text input) · Initial price assumption [initialPrice] (free text; help: "A guess is fine: '$49/month', '$2–5k pilot'") · Payment unit [paymentUnit] (help: "per seat, per order, per site…") · Rationale [rationale].
  - **Market Assumptions**: exactly **three fixed slots** (no add/remove), each a bordered group "Assumption 1/2/3": Statement [statement] · Risk if wrong [risk] (segmented Low/Medium/High) · How you'll test it [validationMethod]. Every slot shows an **Untested** tag with tooltip "This app never marks assumptions as validated. Only evidence from real customers can do that." Copy never uses "validated" for any system-derived state.
- Completion meaning appears once per page as help text near the progress: "*Complete* means the required inputs are filled — not that the strategy is proven."

### 5.5 GTM Dashboard `/startups/:id/dashboard` (customizable plate board)

Answers three questions: *How far am I? What have I decided? What's missing or next?* It is the one screen where the founder can **rearrange plates**.

#### Plate catalog

| id | Plate | Material | Allowed sizes | Default size | Content |
|---|---|---|---|---|---|
| `readout` | Strategy readout | Instrument | M, L | L | `--t-stat` % in mono, "3 of 5 sections complete", segmented bar with section labels, last updated |
| `next` | Next actions | Paper | S, M | S | ≤5 items: server completeness suggestions + next open roadmap tasks. Each item = verb title + link. Done state: "Everything required is in place. Review your roadmap." |
| `decisions` | Decisions | Paper | L, XL | XL | One row per section: status tag · key decision summary (e.g. ICP "Head of Operations · logistics SMEs") · missing fields as deep links · Edit. Under 768 the rows become stacked blocks |
| `gaps` | Missing inputs | Paper | S, M | M | All missing required fields grouped by section, each a deep link `/strategy?section=…#field-…`; count in the header |
| `week` | This week | Paper | S, M | M | Roadmap progress bar ("4 of 9 done") + open tasks of the earliest unfinished week with inline "Mark done" checkboxes (same optimistic behavior as the roadmap) |
| `risks` | Risk watch | Paper | S, M | M | High-risk assumptions with their test method, each tagged *Untested* |
| `channels` | Channel experiment | Paper | S, M | S | Selected channels + the first experiment text |
| `profile` | Profile snapshot | Paper | S, M | S | Name, model, stage, market, segment, link to Overview |

Default order and rows at ≥1280: `readout`(L) `next`(S) · `decisions`(XL) · `gaps`(M) `week`(M) · `risks`(M) `channels`(S), then 2 columns of free space · `profile`(S), with 8 columns of free space. The empty space is part of the composition.

#### Customize mode

- Entry: "Customize" secondary button with a layout icon in the dashboard header. Normal mode never shows drag handles. That keeps the use view calm and stops plates from being moved by accident.
- In customize mode: a sticky bar under the header reads "Customizing dashboard — drag a plate, or use its move buttons." It has [Reset to default] (ghost) · [Cancel] (secondary) · [Done] (primary). Plate content becomes `inert` and is dimmed to 55% opacity. Each plate gets a 1px dashed `--line-strong` outline (no jiggle, no rotation) and a **plate toolbar**:
  - **Drag handle** (`button`, `aria-roledescription="sortable plate"`, `aria-describedby` → instructions). Pointer: press-drag with a 4px activation distance. Keyboard: Space/Enter picks up, arrow keys move by one slot, Space/Enter drops, Esc cancels. Touch: long-press 250ms on the handle only, so scrolling still works.
  - **Move earlier / Move later** icon buttons (`aria-label="Move Risk watch earlier"`). These are the baseline that works without drag. They are disabled at the ends.
  - **Size** segmented control showing only that plate's allowed sizes (S/M/L/XL labels with tooltips "One third / Half / Two thirds / Full width").
  - **Hide** (eye-off). The plate moves to a **Hidden plates** tray at the bottom of the board: "Hidden (2) · Profile snapshot [Show] · Channel experiment [Show]". Plates are hidden, never deleted. The readout plate cannot be hidden, so the core metric always stays visible.
- Announcements (polite live region): "Picked up Risk watch, position 4 of 8." · "Risk watch moved to position 2 of 8." · "Risk watch dropped." · "Layout reset to default."
- Motion: other plates slide into place with FLIP transforms (220ms `--ease-out`); the picked-up plate lifts with a 1.02 scale and a floating shadow. Reduced motion: instant swaps, outline-only highlight.
- **Done** saves the layout (button state "Saving…"). **Cancel** restores the layout from when customize mode was entered. **Reset to default** asks once: "Reset dashboard layout? Your data is not affected." It applies immediately in the draft and is saved on Done. A failed save keeps customize mode open with an inline alert and Retry.
- Leaving the page with unsaved layout changes → confirm dialog.

#### Mobile and tablet

- <768: one stable column in the saved order. Sizes are ignored, and plates keep their natural heights. Customize mode offers **only Move up / Move down and Hide**, as 44px buttons in the toolbar. There is no drag on phones: it fights scroll and offers nothing over the buttons. The bar becomes a sticky bottom bar [Cancel] [Done], with Reset in its overflow.
- 768–1279: drag enabled, with sizes mapped as in §3A.

#### Persistence — **(needs contract)**

Proposed addition to `preferences`: `dashboardLayout: { version: 1, plates: [{ id, size, hidden }] } | null`. The array order is the display order, and `null` means default. Saved through the existing `PATCH /api/startups/:id` preferences patch with `expectedRevision`. Server validation: known ids only, each id once, size within that plate's allowed set, `readout` never hidden. Unknown or missing ids fall back to the default for that id, so new plates added later appear at the end. If GPT prefers not to extend the contract before the deadline, the fallback is `localStorage` keyed by startup id. It must then be labelled "Layout is saved on this device" in the customize bar. The database is preferred: it matches "Preferences persist in the database".

#### States

Loading: skeleton plates in the saved layout (from server render). Empty (0 sections saved): `readout` shows 0% with "Your dashboard fills in as you save strategy sections" and a [Start with Ideal Customer Profile] button. Other plates show one-line empty states. Customize mode still works.

### 5.6 Roadmap `/startups/:id/roadmap`

- **Header**: h1 "30-day roadmap" · linear progress "4 of 9 done (44%)" (skipped tasks excluded from the denominator and labelled "1 skipped") · primary action:
  - No tasks yet → "Generate roadmap".
  - Tasks exist → "Update from strategy" + help "Keeps your progress and edits. Adds tasks for new decisions, archives tasks that no longer apply."
  After running: toast + persistent inline summary "Updated just now: 2 added · 6 kept · 1 archived" with a "What changed" disclosure listing titles.
- **"How tasks are chosen"** disclosure (always available): plain-language list of the rules (from the server's rule metadata, or a static list kept in sync **(needs contract: rule catalog endpoint — optional)**).
- **Filters** (segmented): All · Open · Done; toggle "Show archived" (archived tasks appear dimmed with an *Archived* tag and are read-only except "Restore"? — only if contract supports; otherwise read-only).
- **Layout: "flight plan" timeline.** Time is genuinely spatial here, so the screen shows it.
  - ≥1280: a day ruler 1–30 across the top (mono ticks, a stronger tick every 7 days, and today's position marked if the plan has a start date; otherwise no marker). Below it are 4 **week lanes** side by side, each a column of task plates headed "Week 1 · Days 1–7 · 2/3 done". An instrument plate on the left of the header reads `DONE 4/9 · 44%` in mono.
  - 768–1279: 2×2 week lanes and no ruler.
  - <768: a **vertical timeline**: a thin line down the left edge with week markers (node + "Week 2 · Days 8–14"), and task plates hanging off it in order. No horizontal scrolling.
  - Lanes are `<section>`s with `<h2>`, and tasks are list items, so screen readers get a plain list by week.
- **Task card**: checkbox "Mark done" (44px hit area) · title (strikethrough + muted when done/skipped) · deliverable line ("Deliverable: Interview script and list of 20 prospects") · tags: source (*Suggested* / *Custom*), status tag · "Why this task" disclosure showing `rationale` · status control: on ≥768 a segmented control To do / In progress / Done / Skipped; on <768 a native select. Edit (pencil icon button) expands the card inline into fields: title, deliverable, week (select 1–4), notes; Save / Cancel; uses `expectedRevision`.
  Status change is **optimistic**: UI updates immediately, card shows a tiny "Saving…" then nothing; on failure it reverts with inline "Couldn't update status — Retry" on that card.
- **Add custom task**: ghost button at the end of each week group → inline form (title, deliverable, week preselected, notes) → appears with *Custom* tag.
- No delete controls (per contract). Skipping is the way to dismiss.
- Done-state micro-interaction: checkbox check path draws (stroke-dashoffset, 220ms), card background eases to `--accent-soft` (160ms), progress bar fill updates (`--d-progress`). Nothing else moves; no confetti.

---

## 6. Cross-cutting states

| Situation | UI |
|---|---|
| Initial page load | Route skeleton matching layout. Never a blank page or a centered spinner. |
| Mutation pending | Button loading state; form stays visible; no full-page blocker. |
| 422 validation | Field-level messages from `error.fields`, plus summary if >1. |
| 404 | Not-found view (§5). |
| 409 revision conflict | Inline alert in the affected card/section: "This was changed in another tab or by someone with the link." [Load latest] (discards local edits after confirm) · [Copy my text] (copies the local draft to clipboard). |
| 413 / 415 / 400 | Generic "Something about this request was invalid. Reload the page and try again." |
| 429 | "You're going a bit fast. Try again in a moment." Retry button with 3s cool-down label. |
| 503 / network failure | "Can't reach the server. Your changes are still here." + Retry. Draft stays in the form. If `navigator.onLine` is false, header shows an "Offline" tag. |
| Unexpected error boundary | "Something went wrong on this page." [Try again] [Go to overview]. Error digest in small muted text for support. |

Live regions: one polite region in the layout for save states/toasts; `role="alert"` only for errors after a user action.

---

## 7. Responsive checklist

Breakpoints: **600**, **768**, **1024**, **1280**. Test widths: 360, 390, 768, 1024, 1440.
- No horizontal page scroll at 360px (chip rows scroll inside their own container with scroll-snap and edge fade masks).
- Touch targets ≥ 44×44px; spacing between adjacent targets ≥ 8px.
- Bottom nav never covers content or the primary action (content padding-bottom = nav height + 16px).
- Sticky elements total ≤ 25% of viewport height on mobile (header 56px on <600).
- Forms single-column on <768; side panes collapse as described per screen.

## 8. Accessibility checklist (WCAG 2.2 AA)

Landmarks (header/nav/main/footer), skip link, one h1 and logical heading order, labels for every control, `aria-describedby` for help/errors, `aria-invalid`, `aria-current="page"` for nav, `aria-expanded/controls` on disclosures, Esc closes popovers/sheets and restores focus, no keyboard traps, focus moved to h1 on route change, visible focus everywhere, color never the only carrier of status, contrast per §1, text resizable to 200% without loss, `prefers-reduced-motion` honored, `lang="en"`, forms usable with autofill (`autocomplete="organization"` for name, `url` for website).

Keyboard shortcuts (shown in a "Keyboard shortcuts" item inside Preferences): ⌘/Ctrl+S save current section/edit card · `g o` / `g s` / `g d` / `g r` go to Overview/Strategy/Dashboard/Roadmap (ignored while typing) · `?` show shortcuts.

## 9. Copy rules

Sentence case for buttons and headings; UPPERCASE only in status tags. Buttons name the action ("Save section", "Update from strategy"), never "Submit"/"OK". Errors say what happened and how to recover. Words reserved for founders: *validated*, *proven* — the system never applies them. Use "Complete" (inputs filled), "Draft", "Untested", "Suggested", "Custom".

## 10. Implementation notes for GPT (non-binding)

- Put tokens in `src/app/globals.css`; Tailwind v4 `@theme inline` can map them (`--color-ink: var(--ink)`) so utilities stay theme-aware.
- Read preferences server-side in the workspace layout and set `<html data-theme data-density data-motion data-accent>` to avoid a theme flash; for `/` use a tiny inline script reading `localStorage` (convenience only, not persistence).
- Server Components for reads; a client component only per interactive island (section editor, task card, preferences, copy link).
- `lucide-react` icons; no component kit required. If using one, Radix primitives (Popover, Dialog for the bottom sheet) keep focus management correct.
- I will review the built UI against this spec in `docs/design/REVIEW.md` (desktop + 390px mobile, keyboard-only pass, reduced-motion pass, contrast spot checks).
- Dashboard reordering: `@dnd-kit/core` + `@dnd-kit/sortable` (`rectSortingStrategy`, `KeyboardSensor` with `sortableKeyboardCoordinates`, custom `announcements` matching §5.5). The move buttons call the same `arrayMove` reducer, so there is a single source of truth. Skip drag entirely on `(max-width: 767px)`.
- Plate grid: one `PlateGrid` component that takes `[{id, size, hidden}]` and maps size to `grid-column: span N` per breakpoint via CSS classes. No JS measurement and no `dense` flow.
- Contract question for the lead: please confirm or decline `preferences.dashboardLayout` (§5.5 Persistence). Everything else in this spec fits the current contract.
