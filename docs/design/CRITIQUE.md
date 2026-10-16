# Independent frontend critique

Source/spec review on 16 October 2026, before rendered UI acceptance. These are implementation risks and findings, not claims that the unfinished UI has passed visual review. The review covers the initial frontend foundation and Claude's design revision 0736026.

| Finding | Required action |
| --- | --- |
| Motion is capped in the original spec as CSS-only and one authored moment, while later plate behavior requires FLIP/sortable motion. | Replace the cap with purpose-specific choreography for navigation, expanding editors, saves, completion and rearrangement. Respect reduced motion. |
| Reference notes attribute a ban on continuous working motion and freeform forms to the owner. | Correct attribution: these were agent design judgments, not human restrictions. |
| Hiding Decisions, Missing Inputs and Next Actions could conceal required dashboard behavior. | Retain a compact mandatory summary outside customizable plates. |
| Four narrow week lanes can crowd task controls. | Use compact status menus, realistic long task titles, deliberate hierarchy and actual width checks. |
| Header, strategy chips, save bar and bottom navigation may consume the mobile viewport. | Consolidate sticky layers and verify software-keyboard behavior. |
| Keyboard G+route navigation bypasses the initial dirty anchor/unload guard. | Use one draft-protection mechanism for all navigation paths, including shortcuts and history navigation. |
| Profile Load latest calls router.refresh without replacing useState draft, revision and baseline. | Fetch the current profile explicitly, confirm draft replacement, and reconcile all editor state. |
| Validation focus is attempted before the error renders, on an unfocusable element. | Render a focusable linked error summary and focus after commit. |
| Dialog instances share dialog-title IDs. | Generate unique accessible title IDs. |
| Platform pattern research lacks direct source evidence. | Cite patterns actually used and distinguish observations from proposals. Token contrast math does not substitute for rendered accessibility checks. |

The plate-board revision is a useful improvement: explicit customize mode, fixed sizes, move buttons, reset, consistent DOM order and phone-specific behavior make the flexibility practical. The next gate is real desktop/mobile screenshots and complete interaction testing with realistic content. A written specification alone is not acceptance.
