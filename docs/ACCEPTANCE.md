# Acceptance map

This checklist follows the supplied Orbit GTM Studio assignment. A row marked pending has not yet passed the corresponding acceptance gate. Backend evidence is separate from browser or deployed evidence.

Verified on 16 October 2026: `npm run verify` passes (lint, types, 23 domain/SQL/API regressions, production build). [CI run 38948506396](https://github.com/Eye172/dev-test-assignment-1/actions/runs/38948506396) is green for welcome release code `756b6a5`, merged in PR #7, against PostgreSQL 17: 67 HTTP/desktop/phone scenarios pass without retries. One phone pointer-drag case is deliberately skipped because phones use explicit move controls; those are tested. All 24 selected hosted checks pass on the public Vercel/Neon deployment: HTTP boundaries, both complete six-screen flows, direct URLs/profile edits, custom-task archive/restore, acknowledgement latency, delayed JavaScript, keyboard menus, mobile geometry, the full automated accessibility audit and the welcome's no-JavaScript/reduced-motion behavior at five widths. The public health response is ready/postgres/demo.

| Required behavior | Implementation boundary | Evidence |
| --- | --- | --- |
| Welcome page with Create Startup and demo entry | Claude frontend + demo API | Creation browser journey and manual demo entry pass |
| Validated onboarding, required name/description/model/stage/market/segment, optional valid website | Shared schema, POST /api/startups, profile form | SQL/API and desktop/phone validation journeys pass |
| Unique shareable profile and editable fields | UUID profile, profile PATCH/revisions | SQL/API and hosted desktop/phone edit, context, custom-field and direct-link checks pass |
| Five independently saved/reopened strategy sections | JSONB sections, per-section PUT | SQL/API/durability and desktop/phone save/reload journeys pass |
| ICP: buyer, industry/demographics, pain, trigger | icp schema | Completeness tests pass |
| Value: problem, outcome, differentiation, proof/assumptions | value schema | Completeness tests pass |
| Channels: up to three, each with reason, plus first experiment | channels schema | Custom-name/cap/completeness tests pass |
| Pricing: model, initial price, payment unit, rationale | pricing schema | Text/range support; completeness tests pass |
| Assumptions: three statements, risks and validation methods | assumptions schema | Three-entry completeness tests pass |
| Honest section status; percentage completed/5*100 | Central domain calculation | Whitespace/partial/80%/100% tests pass |
| Dashboard decisions, progress, gaps and next actions | Aggregate workspace + frontend summary/plates | Data/browser progress pass; revised active-work composition reviewed independently |
| Rule-based 30-day plan, 6–10 tasks | Deterministic generator produces 8–10 | Empty/1/2/3-channel deterministic tests pass |
| Each task includes title, week/phase, status and deliverable | Domain/task table/API | SQL/API tests pass |
| User can change statuses and see progress | Task PATCH + aggregate metrics | SQL/API and desktop/phone status/reload tests pass |
| Regeneration does not destroy completed work | Stable rule reconciliation + retained history | Done/custom/edit/archival/idempotence tests pass |
| Profiles, strategy and roadmap survive refresh | Server PostgreSQL/PGlite persistence | Engine close/reopen and desktop/phone reload tests pass |
| Loading, empty, validation, error and recovery states | Claude frontend + typed error contract | HTTP errors, empty plan, validation, failed saves, conflicts and shaped loading state reviewed |
| Responsive desktop/mobile and readable typography | Claude frontend/design | Independent rendered review at 1440 and 390; phone fold, sticky feedback and touch controls pass |
| Environment credentials, synthetic data, no production keys | Server-only DB, env example, demo fixtures | Server credentials remain masked; committed-source archive excludes local env files and is scanned during packaging |
| Modular schema/routes/integration documentation | src/lib/domain, src/server, docs | Schema, HTTP contract, revision/mutation paths and delivery setup reviewed; integration tests pass |
| Optional auth omitted with clear demo labeling | Public synthetic demo | All six routes reviewed; demo label and shared-link disclosure present |
| No private systems or paid AI required | Independent rule engine and DB | Local tests/migrations/seed work without providers |
| GitHub source, meaningful commits, sample env | Repository and history | Published implementation branch |
| Public working demo and seeded direct profile | Vercel + dedicated Neon PostgreSQL | Public alias and fixed seed live; signed-out health confirms ready/postgres/demo; hosted full journeys pass |
| README and one-page handover | README, docs/HANDOVER.md, output/pdf | Live links, setup and evidence recorded; PDF rendered and visually checked as one page |

## Additional user-directed quality gates

The personal workspace must offer useful customization without concealing required information. Layout preferences persist to the database, and missing/duplicate/invalid plate definitions are rejected. Movable panels need keyboard move controls, a reset and a deliberate phone layout. Inputs remain flexible drafts; working order is not locked.

Motion must be authored for the actual interactions, interruptible, performant and comfortable. Respect system reduced motion and the saved preference. Test real content lengths, keyboard access, draft safety, conflict recovery, mobile sticky controls and dialogs. The independent critique in docs/design/CRITIQUE.md is an open action list until checked against the finished implementation.

Browser-proven integration fixes: stable cross-locale timestamp rendering prevents hydration draft loss; mobile save targets no longer move during input blur; declining Escape discard retains the dialog and draft; cancelling keyboard pickup no longer exits customization; acknowledged section saves update shared completeness without blocking on a follow-up read. Custom tasks retain edits through archive/restore.

The subsequent integration adds per-tab recovery across history navigation, original-revision retention for recovered drafts, pending task dismissal protection, acknowledged week-edit updates, guarded status mutations and canonical skipped-task progress bars. Background aggregate reads merge entity revisions so stale responses cannot replace newer acknowledgments. Independent regression cases exercise network latency, failure, conflicts and browser history. Commit `0dd6ccb` limits asynchronous cleanup to the submitted snapshot so an older save cannot clear a newer recovered draft. These checks now pass in the integrated PostgreSQL browser suite. Successful task creation and profile updates also stop waiting for follow-up reads.

Automated accessibility checks cover all six routes, editing/dialog/customization/skipped/share-menu states and nine appearance combinations, with no excluded elements or suppressed rules. Keyboard menu behavior and phone geometry are separately tested. The independent critic's latest assessment is approximately 7.5/10, with no additional concrete motion blocker in the sampled recordings. This judgment does not establish frame-rate performance or WCAG certification. See [the integration review](design/INTEGRATION-REVIEW.md) for evidence and limits.

An earlier CI run (`e394d06`) passed with one retry. Its trace exposed pre-hydration input being combined with a saved value. Release code disables initial form/task controls until their handlers are attached; a held-JavaScript regression covers onboarding, roadmap status and strategy typing. It passes locally, on the public host and in the final clean CI run. This was fixed rather than dismissed as test flakiness.

The welcome refinement's first hosted run exposed a measurement issue: a 44px phone button returned a 43.999969px bounding box while its parent plate translated. CSS, layout dimensions and settled bounds were 44px. The regression now waits for the rendered layout to settle while retaining the exact 44px minimum in both dimensions. The affected scenario passes three consecutive hosted runs; the full 24-check hosted rerun also passes. No product sizing threshold was lowered. The failure trace is retained in the local research evidence.
