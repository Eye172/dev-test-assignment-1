# Remake — review of the shipped frontend and the new direction

Owner: Claude · 2026-10-17 · branch `claude/remake` (from `main` 9a822cd)

Owner brief (human, verbatim intent): not a template; creative but practical; movable plates, unusual placement, mixed styles, free space, platform-aware; strong motion design; simplicity + customisation; personal experience first; no restricted forms; blackorbit.site colours and fonts as inspiration, not a copy; never drop an assignment requirement.

## 1. Cold review of `main` (live at orbit-gtm-studio.vercel.app)

| # | Problem | Evidence | Consequence |
|---|---|---|---|
| 1 | **It is a template.** Near-black page, rounded bordered cards, pill tabs in the header, neon button. Nothing in it could not be a shadcn starter. | Every route | No identity; nothing a reviewer remembers. The Black Orbit family resemblance stops at the hex code. |
| 2 | **The same facts are repeated on every screen.** Completion %, the next task and this week's tasks appear on Overview, Dashboard *and* Roadmap. | Overview "Next move" + "Week 1", Dashboard "This week" + summary "Next", Roadmap readout | Four tabs, two of them (Overview/Dashboard) answering the same question. |
| 3 | **Dashboard customisation produces holes.** Fixed spans with no packing leave a third-of-a-screen void under "Plan progress" and beside "Missing inputs". | desktop-dashboard-A.png | The feature that should feel personal makes the page look broken. Customisation hides behind a separate mode with S/M/L/XL buttons. |
| 4 | **Strategy is a form inside a box inside a box.** Page → editor plate → channel plate → bordered input. "Required" on every label. A "Quick check" plate that mostly repeats the badge. | desktop-strategy.png | Exactly the "restricted form" feeling the owner rejects. No autosave; work is lost unless Save is pressed. |
| 5 | **Roadmap is a ragged card grid.** Two columns per week leave gaps; every card repeats the same chrome (select, "Why this task", two icons). The day ruler under the readout is decorative, not data. | desktop-roadmap.png | Changing status — the most frequent action — needs a native select. Moving a task to another week needs an edit form. |
| 6 | **Motion is an 8px fade.** Route fade, list fades, one nav pill slide. | motion-desktop.webm | Nothing is *felt*; the product has no physical character. |
| 7 | **Type has no scale contrast.** Space Grotesk headings at 32px; everything else 14–16px Inter. | All screens | Flat hierarchy; nothing leads the eye. |
| 8 | **Black Orbit is light-first; we are dark-only in spirit.** The reference canvas is `#f4f7f4` paper with near-black ink and neon used as a fill. | blackorbit.site default theme | Lost the most recognisable part of the reference. |
| 9 | **Welcome tilts cards.** Slightly rotated cards with drop shadows. | desktop-welcome.png | Reads as decoration rather than as the product's own objects. |

What is good and stays: real persistence and revision conflicts, per-tab draft recovery, pending-safe task writes, honest copy ("untested", never "validated"), accessible dialog/menu/keyboard paths, reduced-motion handling.

## 2. Direction: paper and instruments

**One signature object — the Orbit dial.** A dark, round instrument: inner ring = the five strategy sections (filled when complete, dashed when drafted), outer ring = 30 day ticks filled by finished roadmap work, a satellite at today's plan day (counted from when the plan was generated — real data, not decoration). It is navigation, progress and identity at once. It lives large on Overview and the welcome page and small on the navigation rail; the same component everywhere.

**Mixed styles, on purpose.** Light paper canvas (Black Orbit `#f4f7f4`, ink `#06120a`, neon `#00ff5a` as a fill only, `#007a2f` for green text) + dark instrument objects (dial, focus card, readouts). Dark theme inverts the canvas but keeps the instruments. Space Grotesk at editorial sizes for names and numbers (tabular figures); Inter for reading; uppercase tracked micro-labels as the system voice — the reference's typographic grammar, not its layout.

**Unusual but practical placement.**
- Navigation is a floating vertical rail at the left edge on desktop (centred in the viewport, glass, with the mini dial on top) and a thumb dock on phones. The top bar keeps only identity, save state, search and settings.
- Free space is used: the content column breathes; the dial and big type carry the composition instead of boxes.

**Simplicity + customisation.** Every screen answers one question. Overview = who we are and where we stand. Strategy = write decisions. Dashboard = your own board. Roadmap = do the work.
- Dashboard plates are dragged by their grip, resized by dragging the right edge (snapping to the allowed sizes) and hidden into a tray; rows always fill, so there are no holes. Three one-click presets. Every pointer action has a button/keyboard equivalent; the layout is stored in the database.
- Strategy is a writing surface: questions as prompts, answers as large borderless text, autosave (can be turned off per device), live "what's missing" chips that jump to the field, and an optional synthetic example per prompt.
- Roadmap is a four-week board: drag a task to another week, click the ring to cycle status, switch to a compact list. Phones get a stacked timeline.
- ⌘K / Ctrl+K command palette: jump to any section, task or action.

**Motion with a job.** Springs for anything the hand moves (plates, tasks, nav indicator); draw-on strokes for progress (dial segments, status rings, check marks); counting numbers when a value changes; a shared-element morph of the dial between rail and page; masked word reveals only on the welcome page. All motion honours the OS setting and the workspace "reduced" preference.

## 3. Not copied

No Black Orbit name, logo, illustration, copy or font files. The mark is our own (an open orbit with a core and a satellite). Fonts load from the npm Fontsource packages already in the project.
