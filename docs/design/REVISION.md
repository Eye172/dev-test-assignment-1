# Frontend revision — issue #3

Responds to the rendered critique (5.5/10, comment 6213906176) and the functional blockers in comment 6214760795. All evidence is reproducible with `node docs/design/evidence/capture.mjs [baseUrl]` against a running build. It uses a fresh synthetic demo copy.

## 1. Two dashboard compositions, same data

Both captures use the same Fieldnote demo copy: 5/5 inputs filled, 9-task plan, 1 task done.

| | A: shipped in PR #5 | B: authored default now |
|---|---|---|
| Desktop | [desktop-dashboard-A.png](evidence/desktop-dashboard-A.png) | [desktop-dashboard-B.png](evidence/desktop-dashboard-B.png) |
| Phone | [phone-dashboard-A.png](evidence/phone-dashboard-A.png) | [phone-dashboard-B.png](evidence/phone-dashboard-B.png) |
| First read | A 100% "inputs complete" readout | This week's focus task with Start / Mark done |
| Repetition | Completion ×3 (summary, readout, decisions); first action ×3 (summary, Next, This week) | Inputs once in a quiet summary line. The focus task appears once in the plate; "Coming up" lists only later weeks |
| Risk | Full-width list at the bottom | A compact inset beside the active work, holding only the riskiest belief |
| Phone | An inventory of 8 equal plates | Summary line → focus → risk → readout → queue → decisions (1-line clamp) → gaps. Profile and Channels start hidden and can be restored |

**Chosen: B.** Filled inputs are a starting line, not the founder's achievement. B gives the most space to the next piece of market work and the belief most likely to change the plan. Once inputs are complete, the readout's large figure switches from input % to plan progress. A put the commercially least meaningful number in the most prominent spot.

**Data contract:** unchanged. `defaultDashboardLayout()` now encodes B: order `week, risks, readout, next, decisions, gaps` with `channels` and `profile` hidden. `week` additionally allows `L`. The schema rules are untouched: every plate exactly once, allowed sizes, readout visible. A founder's saved layout still wins, and Reset returns to B.

## 2. Composition beyond the dashboard

- **Overview** ([desktop](evidence/desktop-overview.png), [phone](evidence/phone-overview.png)): an asymmetric work column (large identity → next move → this week → riskiest belief) beside a narrow facts rail. The rail holds the one instrument, the facts as hairline rows (not cards), custom fields and an Edit button. The phone layout puts the work first and the facts in two columns.
- **Shell**: the floating dock is gone, because it covered content in the critic's captures. Navigation sits in the header on wide screens. Phones get a solid four-item tab bar that reserves its own space. Share and Export moved into a header menu.
- **Identity**: no screws, bezel or inset screen. Hierarchy comes from scale (display-size name and focus task), hairline rails, one dark instrument per screen, a red-tinted risk inset, and dashed "quiet" plates when there is nothing to report.
- **Roadmap** ([desktop](evidence/desktop-roadmap.png), [phone](evidence/phone-roadmap.png)): week bands, a canonical progress readout, and human rule names ("Rule: Customer interviews"). Internal identifiers never reach the interface.

## 3. Motion as built

[motion-desktop.webm](evidence/motion-desktop.webm) and [motion-phone.webm](evidence/motion-phone.webm) record navigation, editing and saving, customizing (move, resize, hide, cancel), a status change, inline task editing and adding a custom task. They were recorded headless at 1×, so frame pacing is approximate. Judge the choreography from them, not smoothness.

| Moment | Motion | Duration |
|---|---|---|
| Change view | Header pill slides (shared layout). The incoming view rises 8px and fades in; the shell stays still | 200 ms |
| Enter dashboard / overview | Plates settle in reading order, 40–60 ms apart, at most 6 steps | ≈ 300 ms total |
| Rearrange / resize | Neighbours spring to new slots. The picked-up plate lifts; edges auto-scroll | spring 420/38 |
| Expand task editor | The card resizes in place and content cross-fades. Focus stays in the card | 140 ms fade |
| Save / status | Spinner, then an inline "Saved · hh:mm UTC" tick pop and a toast. Status pill colour transitions | 160–260 ms |
| Welcome | Plates settle (CSS keyframes, no JavaScript needed); the launch dot exits through the ring's gap once | ≈ 1.5 s, once |

**Never hidden at first paint.** Entrance motion runs only for in-app navigation after hydration. Server-rendered content is visible immediately, even if JavaScript is slow or the tab is in the background. We found this by rendering in a backgrounded browser, where an `opacity: 0` start left the page blank.

**What does not move:** typing, readout numbers (no counting), hover layout, and anything in a loop. Reduced motion (OS setting or workspace preference) turns all of the above into instant state changes.

## 4. Functional fixes (comment 6214760795 and found during this revision)

| Bug | Fix | Regression test (`e2e/frontend-regressions.spec.ts`) |
|---|---|---|
| Add-task dialog could close or reset during a pending POST | `Dialog locked`: Escape, the backdrop and Close do nothing while saving. The draft stays until acknowledged | "a pending custom task cannot be dismissed…" |
| Notes and week were ignored by dirty detection | The whole draft is compared | "notes and week alone make a custom task draft dirty" |
| An inline edit's optimistic week change unmounted the editor; a failure lost the draft | Editor saves are not optimistic; the card changes only after acknowledgment | "a failed task edit keeps the editor and draft…" |
| Two progress formulas (100% vs 88%) | One `RoadmapBar` driven by the backend's `roadmapProgress`, with skipped labelled "not counted" | "every progress display uses done ÷ actionable…" |
| Browser Back/Forward lost drafts | Per-tab draft recovery (sessionStorage via `useSyncExternalStore`) for strategy sections, profile, task edits and new tasks. A restored draft keeps its base revision, so saving over newer data raises the normal conflict | "browser Back/Forward offers the unsaved strategy draft…" |
| Overlapping writes on one task (stale revision, rollback over the newer result) | One write per task at a time; its controls are disabled while it is pending | "overlapping status changes… are blocked" |
| **Found here:** the draft mirror's effect depended on the value it writes, an infinite update loop on the first keystroke | The stored value is no longer a dependency | "typing in the strategy editor does not loop…" |
| **Found here:** reordering moved the drag handle's DOM node and dropped pointer capture. No drop was announced, the plate stayed lifted, and an interval leaked | Window-level pointer listeners keyed by `pointerId`, plus swap hysteresis against oscillation | GPT's drag test, 15/15 under `--repeat-each` |
| **Found here:** plate content stayed clickable in Customize mode | Content is `inert` and pointer-inert while customizing | "customize mode makes plate content inert" |

## 5. Verification

- `npm run verify`: lint, typecheck, 23 unit tests and production build pass.
- `npx playwright test`: 32 passed, 2 intentionally skipped (phones use move buttons rather than pointer drag). Projects: API, desktop 1440×1000, mobile (iPhone 13). The suite fails on any page error or hydration error.

## 6. Not verified / open

- The hosted demo still serves GPT's integration build. This branch needs merge and deploy before hosted acceptance.
- No real iOS Safari or Android software-keyboard test; the phone checks use Chromium emulation.
- No screen-reader session. Checks cover roles, names, live-region text and `inert` only.
- Stills are dark theme only. The light theme passes the acceptance test but was not screenshot-reviewed in this round.
- Files outside my usual area, all changed deliberately: `src/lib/domain/dashboard.ts` (authored default, `week` allows L), `tests/backend.test.ts` (layout test targets the readout by id rather than position) and `e2e/workspace.spec.ts` (export via the Share menu; the hide/reset assertions follow the new default; the drag test waits for settled positions and paces its pointer).
