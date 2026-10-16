# Motion and composition addendum (as implemented)

> Superseded in part by [REVISION.md](REVISION.md) (issue #3): header navigation replaces the floating dock, the dashboard default is the active-work composition, and entrance motion never hides first paint.

Supersedes the motion cap in SPEC.md §6 ("CSS-only, one authored moment"), as the independent critique asked. Motion now has a job per surface. Anything without a job does not move.

## What moves, and why

| Surface | Motion | Purpose | Implementation |
|---|---|---|---|
| Navigation dock | Active pill slides between items (shared layout, spring 420/38) | Shows where you went, without a page-level transition | `motion` `layoutId="dock-active"` |
| Strategy section rail | Current marker slides between stations; editor enters 12px from the right, leaves 8px left | Ties the editor to the station you picked | `layoutId="rail-current"`, `AnimatePresence mode="wait"` (200ms in, 120ms out) |
| Channel rows | Height + opacity on add/remove | Shows where the new row went | `AnimatePresence` + `layout` |
| Save | Button shows spinner; inline save state; toast rises 10px | Confirms the write, says whether it was saved as a draft | CSS + `motion` toast |
| Dashboard customize | Plates FLIP into new slots on move, resize or hide; picked-up plate lifts with outline and shadow | Shows the cause and effect of a rearrangement | `layout="position"` per plate frame, spring |
| Roadmap status/regenerate | Cards reflow with FLIP when tasks are archived or restored | Shows where a task went | `layout="position"` |
| Progress bars | Width eases over 450ms | Shows the change after a save or status update | CSS transition |
| Welcome visual | Plates settle (staggered 45ms), launch dot exits through the ring's gap, once | The product's one authored moment | `motion`, static under reduced motion |
| Buttons | scale 0.98 on press | Tactile feedback | CSS, 100ms |

## What deliberately does not move

- No continuous or looping animation in the working interface: no ambient orbit, no pulsing badges, no marquee. Skeleton shimmer is the only loop, and it only shows while data is loading.
- No scroll-triggered reveals: content is never hidden waiting for scroll.
- No animated numbers: readouts change instantly, because a counting number delays the answer.
- No page-wide route transitions: only the content that changed moves.
- No artificial delays: nothing waits for an animation before content is usable.
- No rotation or tilt inside the app: tilted plates exist only on the welcome page.
- Hover never moves layout: only colour and background change.

Reduced motion: `MotionConfig reducedMotion` follows the workspace preference (`motion: reduced` → always), otherwise the OS setting. CSS durations collapse to ~0 under either. The welcome visual renders its final state.

## Composition as built (differences from SPEC.md)

- **Navigation is a floating dock**, not a sidebar. It sits bottom-center on every width, so it is in thumb reach on phones and stays out of the content column on desktop. The lead asked for a compact persistent dock. Keyboard: `G` then `O/S/D/R`.
- **The dashboard keeps a mandatory summary strip** (strategy %, missing inputs, roadmap done, next step) above the customizable plates, so hiding plates never hides required information. This responds to the critique.
- **Drag is in-house, with no new dependency.** Pointer drag on the handle snaps the plate into the slot under the pointer, and Motion animates the reflow. Keyboard pick-up uses Space/Enter, then arrows, then Space/Enter, with Esc to cancel. Move earlier/later buttons are the baseline. There is no drag on phones: move up/down and hide only.
- **The roadmap uses stacked week bands**, not four narrow lanes, which also responds to the critique. Each band has a sticky week label and a responsive task grid, so long titles and the status menu have room. Phones get a vertical timeline. A 1–30 day ruler sits in the instrument readout.
- **Strategy short answers** (buyer type, industry, pricing model, price, payment unit) are single-line inputs; reasoning fields are textareas.
- **Draft protection is one mechanism** shared by in-app links, keyboard shortcuts and page unload. Browser back/forward within the app is not intercepted, because Next's App Router reloads on foreign history state. That is a known gap.

## Attribution correction

REFERENCE.md previously said the owner asked for no continuous motion. The owner's priorities were relayed by the lead ("avoid continuous animation in the working interface"). The specific bans above (scroll reveals, tilted chips, animated numbers, freeform form canvas) are Claude's design judgments, not owner instructions.
