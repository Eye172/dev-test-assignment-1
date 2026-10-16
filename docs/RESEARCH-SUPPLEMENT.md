# Research decisions and evidence

16 October 2026. Technical lead's supplement to Claude's visual research. These are proposed implementation and review criteria, not owner-imposed aesthetic restrictions. Claude owns the final frontend composition. No rendered UI has passed design acceptance yet.

## What was actually studied

Claude documented live computed typography, colors, spacing, components and motion from [Black Orbit](https://www.blackorbit.site) in `docs/design/REFERENCE.md`. GPT separately reviewed the site's five-stage process and evidence hierarchy. This provides family resemblance and product context; its landing page is not a complete working-app design system.

GPT inspected source and available screenshots from the owner's inVisionU, WhiteBox, AgentDeck, CampusLense and Searchious projects. They show multiple directions: electric accent on dark, tactile cream/forest/rust surfaces, editorial light layouts and spatial canvases. This supports deliberate composition and contrast rather than assuming the owner has one fixed visual style. Local captures are research evidence, not assets to redistribute.

The supplied animation and useful-repository lists were reviewed for relevant motion and layout references. A reference appearing in a list does not mean its entire source or license was audited. No third-party animation code has been adopted on that basis.

The supplied Instagram post was accessible in GPT's browser at the microanimations slide. Its exact requested slide 8 was not reliably inspected. Claude reported more limited access in its own browser. Do not claim a full carousel analysis.

## Comparative findings

| Primary source actually read | Useful finding | Application proposed for Orbit | Reject or verify |
| --- | --- | --- | --- |
| [Linear: redesign process](https://linear.app/now/how-we-redesigned-the-linear-ui) | Reduce navigation noise; assess complete flows across environments, appearance and hierarchy. | Give the founder's next decision more emphasis than shell controls. Compare the same realistic workspace across overview, editor and roadmap. | Do not copy Linear's sidebar or treat a polished hero as proof the whole app works. |
| [Rauno: contrasting aesthetics](https://rauno.me/craft/contrasting-aesthetics) | Intentional aesthetic contrast can create a focal point; equal emphasis weakens it. This is a designer's essay, not an empirical usability standard. | Contrast expressive orbital readouts and editorial headings with quiet, precise working controls. Use different plate scales to create hierarchy. | Avoid applying glass, glow, grids and oversized type everywhere. Check whether the composition still has a clear first read. |
| [Rauno: interaction design](https://rauno.me/craft/interaction-design) | Immediate feedback, interruption and spatial continuity help an interaction respond to intent. Repeated actions need different treatment from novel moments. | Panels follow the pointer directly; their neighbors settle into place. An expanding editor retains its visual source. Frequent saves provide brief status feedback. | No animation should delay typing, require waiting before reversing an action, or obscure unsaved data. |
| [Microsoft Fluent: motion](https://fluent2.microsoft.design/motion) | Motion communicates relationships, hierarchy and state; choreography should stay focused and provide a reduced-motion experience. | Define distinct navigation, expansion, rearrangement and status transitions with one shared motion vocabulary. | A universal fade on every element is not an authored motion system. Verify large rearrangements and slow devices in the browser. |
| [W3C: dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Drag functionality needs a single-pointer alternative without dragging; keyboard support alone does not satisfy this criterion. | Visible move buttons or a position menu alongside drag handles. Preserve the same outcome and saved ordering. | Do not hide the only alternative behind keyboard shortcuts or require long-press dragging on phones. |
| [Atlassian: drag accessibility](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines) | Expose meaningful outcomes, announce moves and preserve focus for repeated operations. | After moving a plate, keep focus on its control and announce its new position. Make customization an explicit mode with a reset. | A sortable library alone does not provide a complete accessible experience. Test the actual controls and announcements. |

## Proposed choreography to build and compare

These timings are starting values for browser evaluation, not restrictions from the technical task or owner.

| Moment | Choreography | Starting range | Acceptance evidence |
| --- | --- | --- | --- |
| Enter workspace | Establish the main readout, then the next action, then supporting context with a short stagger. | 240–360 ms total | Main action is immediately usable; no blank scroll-reveal content. |
| Change workspace view | Keep navigation stable; transition the active indicator and incoming content with restrained spatial continuity. | 140–220 ms | Repeated navigation remains fast and draft protection runs first. |
| Open editor/details | Expand from the selected surface; preserve the relationship to its source. | 220–320 ms | Focus moves deliberately; Escape/close returns it; interrupted motion is safe. |
| Rearrange/resize plates | Pointer movement is direct; surrounding plates animate to their new positions. | 180–300 ms settling | No surprise dense-grid reordering, text stretching or lost scroll position. |
| Save or task status | Brief icon/status transition and clear persistent result. | 120–180 ms | Failure restores an honest state and retains the user's draft. No fake success. |
| Reduced motion | Remove spatial travel and stagger; retain immediate state and focus feedback. | Immediate or brief opacity | All features and information remain available. |

## Design acceptance, not a source-count target

1. Show two materially different dashboard compositions using the same real data and explain the final choice. A different accent color is not a different composition.
2. Review desktop, tablet and phone with long names, multiline decisions, missing inputs and a full roadmap. Phone layout must be designed, not merely collapsed.
3. Review a recording of navigation, editing, saving, customization and task status changes. Static screenshots cannot establish motion quality.
4. Complete all required flows using keyboard and single-pointer controls. Check focus, dialogs, error recovery, reduced motion, sticky controls and draft safety.
5. Check whether customization changes a useful working arrangement and survives reload. Required completion, decisions, gaps and next actions must remain discoverable.
6. Reject generic repeated-card composition if it obscures hierarchy. Reject unusual placement if it makes the next useful action harder to find.

Research is substantial and focused, but this is not a claim of a comprehensive market survey, empirical user study, or completed visual validation. The next meaningful evidence is a working prototype and independent review.

## Independent critic: additional precedents

The critic read these primary documents, without claiming interactive tours or measured animation timing. The main critique is that eight equally prominent plates could create a showroom instead of a personal workspace. The catalog is a capability, not a mandate for equal visual weight.

| Documented precedent | Proposed application | Boundary |
| --- | --- | --- |
| [Milanote columns](https://help.milanote.com/en/articles/10478526-columns): grouping, collapse and insertion feedback | Keep each movable panel a meaningful unit; show its destination clearly. A collapsed panel retains its identity and useful count. | Avoid nested dragging and movable individual form fields. |
| [Apple Freeform scenes](https://support.apple.com/en-ca/guide/freeform/frfm7cc55b64/mac): named views and framing across devices | Optionally compare working presets such as Plan, Execute and Review using existing layout preferences. | Only after required flows pass; no infinite canvas or desktop coordinates carried onto phones. |
| [Arc Peek](https://resources.arc.net/hc/en-us/articles/19335302900887-Peek-Preview-Sites-From-Pinned-Tabs): contextual preview with expansion | A task's rationale and source decision can open without losing week, filter or scroll context, with a link to the full editor. | No modal chains or parallel editing system; restore focus and protect drafts. |
| [Teenage Engineering OP-1 guide](https://teenage.engineering/guides/op-1/original/quick-guide): controls paired with visible state | Make the signature readout display five real section states, missing-input counts and actual task progress. Animate action-driven changes. | No decorative knobs, invented telemetry or market-readiness scores. |

Proposed review weights: practical hierarchy 25%, composition/craft 20%, personalization/adaptation 20%, motion 15%, mobile/accessibility 20%. These are internal critique weights, not the assignment's grading rubric. Missing assignment behavior, draft loss, false validation, inaccessible controls and broken direct links are hard failures regardless of visual score.
