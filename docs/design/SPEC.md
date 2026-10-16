# Frontend design specification — Orbit GTM Studio

Owner: Claude (design) · Implementer: GPT (lead) · Status: proposal for lead review · 2026-10-16

Evidence base: [REFERENCE.md](REFERENCE.md). Data/API truth: [../CONTRACT.md](../CONTRACT.md) — this spec never changes the contract; where a UI idea needs data the contract lacks, it is marked **(needs contract)** and is optional.

## 0. Direction in one paragraph

A calm, precise **working tool** that is visibly a sibling of Black Orbit: off-white green-tinted canvas, near-black ink, one electric-green accent, hairline cards, pill controls, honest status words. It is an *Operate* surface, so familiarity beats flourish: one sans for UI, a grotesk only for titles and key numbers, motion only to confirm state. The founder can start anywhere, save half-finished thoughts, and always sees what is complete, what is missing and what to do next. Nothing is ever presented as "validated" unless the founder says so.

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
- **Visual**: the product's own flow drawn as crisp SVG geometry — Profile → 5 strategy sections → 30-day plan → Progress, as an orbit with the mark's launch dot. **The one authored motion moment of the app**: on first paint the launch dot travels along the ring and exits through the gap (700ms, `--ease-out`, once). Static under reduced motion. Decorative → `aria-hidden`.
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

- **Header**: h1 = startup name; meta row of tags: business model, stage, market; website link (external icon, `rel="noopener"`). Actions: "Edit profile" (secondary), Copy link (ghost, toast "Link copied", fallback: select-able URL field if clipboard is denied).
- **Profile card**: description, customer segment, context, custom fields (key/value list). **Edit mode is inline** (the card turns into the same form as §5.2, plus custom fields editor with "Add field"), Save / Cancel; uses `expectedRevision`; 409 → conflict alert (§6).
- **Strategy progress card**: "2 of 5 sections complete" + `--t-stat` "40%", segmented bar (§4) with links; a "Continue strategy" primary button that deep-links to the first incomplete section.
- **Next step card**: one recommendation, derived from data in this priority: (1) a section with missing fields → "Finish *Pricing & Revenue*: add payment unit and rationale" [Open section]; (2) all complete but no roadmap → "Generate your 30-day roadmap"; (3) roadmap exists → next open task in the earliest week [Open roadmap].
- **Roadmap snapshot**: "4 of 9 tasks done" linear bar + the next 3 open tasks (title + week tag), or an empty state "No roadmap yet" [Generate roadmap] (enabled always; tooltip explains the plan adapts to whatever is saved).

### 5.4 GTM Builder `/startups/:id/strategy`

- **Section selection** is in the URL: `?section=icp|value|channels|pricing|assumptions` (default: first incomplete, else `icp`). Field deep link: `#field-<name>` scrolls to and focuses the field.
- **≥1024**: two panes. Left (280px, sticky): 5 section rows — number, name, status tag, missing count ("2 missing"); current row highlighted. Right: the editor.
  **<1024**: sticky horizontally-scrollable chip row of the 5 sections (status icon + short name) above the editor; current chip scrolled into view.
- **Editor anatomy** (each section): h2 section name · one-line purpose (muted) · save-state indicator · fields · **"Required for Complete" checklist** (live, client mirror of the server rule; items link to fields; server response is authoritative) · Notes (optional, collapsible) · footer: [Save section] primary, [Next section →] ghost (after a successful save it becomes the emphasized action).
- Saving: explicit per-section Save (button, or ⌘/Ctrl+S when focus is inside the section). Draft saves are always allowed — incomplete sections save as *Draft*. Switching sections or leaving with unsaved changes → confirm "You have unsaved changes in *Value Proposition*" [Save and continue] [Discard] [Stay]. `beforeunload` guard while dirty. Failed save keeps the edits in the mounted form and shows *Couldn't save — Retry*.
- **Section content** (labels = founder language; contract keys in brackets):
  - **Ideal Customer Profile**: Buyer type [buyerType] (help: "Who signs or pays? e.g. Head of Operations") · Industry or demographics [industry] · Primary pain point [painPoint] · Buying trigger [buyingTrigger] (help: "What event makes them look for a solution now?").
  - **Value Proposition**: Customer problem [problem] · Promised outcome [outcome] · Differentiation [differentiation] · Proof or assumptions [proof] (help: "What evidence you have — or what you're assuming. It's fine to say 'assumption'.").
  - **Acquisition Channels**: 1–3 channel rows, each = Channel [name] (combobox) + Why this channel [reason]. "Add channel" (disabled at 3 with helper "Up to 3 channels — focus beats coverage."). Remove-row icon button on rows 2–3 (`aria-label="Remove channel 2"`; removing an unsaved draft row is immediate; removing a saved row happens on Save). First acquisition experiment [firstExperiment] (help: "Small, time-boxed, with a success criterion — e.g. 'Message 30 ops managers; success = 5 calls booked'.").
  - **Pricing & Revenue**: Pricing model [model] (select: Subscription, Usage-based, One-time, Freemium → paid, Paid pilot → contract, Commission / take rate, Other — "Other" reveals a text input) · Initial price assumption [initialPrice] (free text; help: "A guess is fine: '$49/month', '$2–5k pilot'") · Payment unit [paymentUnit] (help: "per seat, per order, per site…") · Rationale [rationale].
  - **Market Assumptions**: exactly **three fixed slots** (no add/remove), each a bordered group "Assumption 1/2/3": Statement [statement] · Risk if wrong [risk] (segmented Low/Medium/High) · How you'll test it [validationMethod]. Every slot shows an **Untested** tag with tooltip "This app never marks assumptions as validated. Only evidence from real customers can do that." Copy never uses "validated" for any system-derived state.
- Completion meaning appears once per page as help text near the progress: "*Complete* means the required inputs are filled — not that the strategy is proven."

### 5.5 GTM Dashboard `/startups/:id/dashboard`

Answers three questions top-to-bottom: *How far am I? What have I decided? What's missing / next?*

- **Summary row**: Strategy progress (`--t-stat` %, "3 of 5 sections complete", segmented bar) · Roadmap progress ("4 of 9 tasks done", linear bar, "Week 2 of 4 focus" if derivable) · last updated time.
- **Decisions table** (one row per section; on <768 rows become stacked blocks): Section · Status tag · Key decision (1–2 saved values summarized, e.g. ICP: "Head of Operations · logistics SMEs"; Channels: "LinkedIn outreach, Partnerships"; Assumptions: "3 untested · 1 high risk") · Missing (comma list of missing field labels, each a link to `/strategy?section=…#field-…`) · [Edit] link.
- **Next actions** list (max 5): merges server-provided completeness suggestions + next open roadmap tasks; each item = action verb title + where it leads. If none: "Everything required is in place. Review your roadmap progress." 
- **Risk watch**: assumptions with risk = High, listed with their test method, tag *Untested*.
- Empty state (0 sections saved): one card "Your dashboard fills in as you save strategy sections" [Start with Ideal Customer Profile].

### 5.6 Roadmap `/startups/:id/roadmap`

- **Header**: h1 "30-day roadmap" · linear progress "4 of 9 done (44%)" (skipped tasks excluded from the denominator and labelled "1 skipped") · primary action:
  - No tasks yet → "Generate roadmap".
  - Tasks exist → "Update from strategy" + help "Keeps your progress and edits. Adds tasks for new decisions, archives tasks that no longer apply."
  After running: toast + persistent inline summary "Updated just now: 2 added · 6 kept · 1 archived" with a "What changed" disclosure listing titles.
- **"How tasks are chosen"** disclosure (always available): plain-language list of the rules (from the server's rule metadata, or a static list kept in sync **(needs contract: rule catalog endpoint — optional)**).
- **Filters** (segmented): All · Open · Done; toggle "Show archived" (archived tasks appear dimmed with an *Archived* tag and are read-only except "Restore"? — only if contract supports; otherwise read-only).
- **Layout**: grouped by **Week 1–4** (each group: heading "Week 1 · Days 1–7", count "2/3 done"). ≥1280: 4 columns side by side (board); 768–1279: 2×2; <768: single column of week groups.
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
