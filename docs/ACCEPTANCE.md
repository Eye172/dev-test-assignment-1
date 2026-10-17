# Acceptance map

Final assembly, 17 October 2026. The original assignment and the owner's AI expansion are assessed separately. The application remains a synthetic shared demo; saved inputs and completed tasks do not validate a market.

The earlier release evidence below did not establish that the normal onboarding path used AI. Its browser cases exercised offline extraction or mocked provider responses, and its hosted real-provider check called the API directly. The owner reproduced that Continue bypassed AI and repeated fixed questions. Calling those checks full product verification was incorrect. Accessibility and reduced-motion screenshots also did not establish acceptable motion behavior.

The repair changes the primary action to Continue with AI, resumes analysis after owner unlock, asks case-specific model-generated questions and retains answers as separate private specialist context. Known profile fields are not asked again. The explicit offline path remains available. Launch distinguishes running, locked, failed and reviewable results and links directly to the saved AI run. Home controls render immediately, and onboarding no longer waits for serialized screen exits.

Actual browser/provider evidence: a piano MVP in Almaty generated five questions about the feedback problem, review labor, customer trials, offer and teacher access. A bakery planning idea in Shymkent generated questions about owner recruitment, operational records and the first test. A separate real production browser submission generated “How can you reach bakery owners in Shymkent for interviews or an initial test?” after owner unlock automatically continued the requested analysis. Local intake IDs are `b3e4620e-ba9b-42b0-b6e9-aa04d79c458f` and `230738a9-e2ae-4057-9c51-5a3d471edc44`; these were actual provider outputs, not fixtures. Their captured UI and private JSON remain under ignored `.data/repair-qa`.

The repaired contracts pass 68 domain/SQL tests; 14 focused desktop/phone onboarding checks pass. Those UI fixtures verify routing, typed state, question filtering, answer retention and recovery; model relevance is assessed separately with the real cases above. An actual desktop pointer-drag defect was fixed by hit-testing stable document slots rather than animated cards; the real pointer, keyboard cancellation, save and reload regression passes. Browser tests use Chromium desktop/phone emulation, not physical-device certification.

The actual piano council `62682f98-521b-4978-ab5e-42480ba5e04f` completed all six roles and one correction round through the interface, including automatic checkpoint continuation. It preserved the KZT 5,000 offer, assumed KZT 3,000 reviewer fee, five-review weekly ceiling and excluded ads, compared two captured primary sources with the current workflow, and corrected biased discovery screening. It also exposed a backend context defect: the critic lacked the server's clearance for corrected pricing and requested a check that had already passed. The immutable run remains needs_attention rather than being edited into a success. A fresh deterministic recheck passes all five non-critic artifacts. Prompt 2.0.11 now supplies exact-hash validation receipts; only validator-originated issues are classified as machine findings. A model's “Contract:” title no longer makes its judgment unwaivable.

Actual focused continuation `e004b383-535d-4185-bf09-a09e2ab34552` completed interpretation, experiment design and independent critique with no open registered concerns. It explicitly inherited the captured comparison and corrected strategy rather than claiming fresh research. Its seven-task plan was reviewed in the UI, unknown resources acknowledged as conditional, and applied to the working roadmap. Exactly one AI plan is active. A task status changed to in_progress and survived reload. The [saved real AI roadmap](verification/repair-2026-10-17/real-ai-roadmap.jpg) shows seven tasks and honest zero completed tasks. Reported-token estimated cost was USD0.682124 for the continuation; the earlier full council was USD1.626374. These are application estimates, not provider invoices. Earlier blocked output remains in private history.

The expanded complete suite on `accf335` passed 91 HTTP/desktop/phone checks with one intentional phone pointer-drag skip and no retries. [PostgreSQL 17 CI](https://github.com/Eye172/dev-test-assignment-1/actions/runs/39009700854) also passed on that exact commit. A later UI correction keeps a newly created follow-up and explicitly selected historical run in the URL, preventing reload from showing a prior run. All six focused desktop/phone analysis checks pass, including the two new selection regressions. The focused analysis rerun additionally waits for the visible arrangement-save acknowledgement before accepting memory; a diagnostic trace showed one post-save read taking approximately ten seconds while the server processing itself took 38ms. This synchronization does not alter product validation or suppress a failed assertion.

Real production captures show the contextual question on [desktop](verification/repair-2026-10-17/production-contextual-question.jpg) and [390px phone](verification/repair-2026-10-17/phone-contextual-question.jpg). The phone document width is 390px with no horizontal page overflow. These captures demonstrate the actual provider-backed question, not animation frame-rate measurements.

The following release record is historical and is not evidence for the previously untested primary AI journey:

The release candidate passed [PostgreSQL 17 CI](https://github.com/Eye172/dev-test-assignment-1/actions/runs/38989111639) before PR #12 was merged. Production deployment `7132849269` succeeded on merged `f5faa8a`; all 24 selected signed-out hosted HTTP/desktop/phone checks passed without retries, including the full founder flow on both viewports. A separate real production OpenAI interpretation `262d272f-f2ea-4b31-a910-5706600d3a97` passed the idempotency, confirmed-stage, channel-exclusion and budget/price checks (590 input / 283 output tokens; estimated USD0.004010). Public health is ready/PostgreSQL/demo and unauthorized private AI export returns 401.

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
| GitHub source, meaningful commits, sample env | Repository and history | PR #12 merged to main; committed source ZIP supplied |
| Public working demo and seeded direct profile | Vercel + dedicated Neon PostgreSQL | Public alias and fixed seed live; signed-out health confirms ready/postgres/demo; hosted full journeys pass |
| README and one-page handover | README, docs/HANDOVER.md, output/pdf | Live links, setup and evidence recorded; PDF rendered and visually checked as one page |

## Owner-directed AI and integration gates

| Behavior | Evidence |
| --- | --- |
| Relevant competitor/substitute/current-workflow comparison, case-specific axes, advantages/disadvantages and next tests | Typed research coverage checks; browser comparison; real synthetic courier case |
| Captured source text, timestamps, hashes, reported versus inferred claims, explicit unknown billing terms | SQL/provenance tests, source inspection UI, real inherited primary passages; source URLs are not counted as verified pages |
| Versioned hypotheses/decisions, options, counterarguments, observation links and reopening conditions | SQL + desktop/phone memory flow, manual memory before paid work, real adverse-evidence follow-up |
| Concurrent/new observations remain unacknowledged until explicitly reviewed | Regression for evidence arriving after an editor opened; no silent conclusion/status changes |
| Complete transitive support across accepted decisions, option references, pending hypotheses and correction rounds | SQL/context regressions, including a fresh run without parent artifacts |
| One current plan, reconciliation of old suggestions and protected human work, time/currency/dependency limits | SQL + real HTTP plan preview/apply/idempotency; browser capacity errors, editable scope and conditional limits |
| Exact task references and independent review | Snapshot aliases resolve only to their own UUIDs; unknown/mistyped identifiers are blocked; specialists cannot close their own issues |
| Free/guided inputs and readable attachments reach agents | PDF/DOCX/PPTX browser extraction checks, full private material snapshots, guided answer/confirmed-profile tests |
| Explicit paid consent and idempotent recovery | Lost creation acknowledgement returns one startup; latest checkbox state wins; pending answers and launch survive reload |
| Optional pre-creation AI | Real owner-only HTTP interpretation passes stage, excluded-channel, budget-versus-price and idempotency checks; UI provider states are separately mocked |
| Public/private boundary | Owner HTTP gate, scoped IDs and exports tested; public workspace export excludes briefs, observations, documents and memory |
| Flexible private information displays | Browser reorder/hide/collapse/restore, memory editors, plan preview and accessibility checks; separate from the eight public dashboard plates |

## Real API evidence and its limits

Synthetic Dispatch Note case: courier teams with 5–20 drivers in Almaty; USD300 experiment budget; eight sales hours weekly, with total delivery capacity unconfirmed. The six-specialist run `55b78fe2-19e5-4b04-895b-020ee924023b` completed with all five section proposals, eight experiments and no final critic issues. Its estimated reported-token cost was USD0.769746. Owner-only HTTP acceptance applied the sections and plan, confirmed 100% saved-section completion, repeat-safe application/evidence, private observations and review reopening after five contradictory interviews.

Follow-ups retained the source ledger and new observations and proposed eight revised experiments. An actual bad task UUID was blocked. Testing also exposed missing earlier-round/transitive memory context and a critic misunderstanding of server-normalized task UUIDs; regressions and explicit conversion receipts now cover these causes. The final follow-up `51fb3b7f-a7ec-42df-9130-adb23b691e8e` has no machine reference blocker and retains material historical-review notes rather than inventing consensus. Findings now carry their originating snapshot time so an old empty-profile observation is not treated as current state. No claim is made that every future model response passes critique.

Source research was genuinely performed in earlier runs and explicitly inherited during these continuations. The ledger's 81 returned URLs are not 81 read or independently verified pages. Missing/local-market evidence and vendor limitations remain visible. Costs are application estimates from reported token/tool usage, not reconciled provider invoices; interrupted-call reservations remain for owner review.

The real preflight run `53c6070f-98cd-4865-8881-9cdc6f2748f5` completed through HTTP with one request ID, 594 input and 217 output tokens (estimated USD0.003358). It retained Idea/B2B, excluded unwanted channels and did not confuse the experiment budget with a selling price. Raw private evaluation exports stay outside Git under .data/ai-evals.

## Review and recovery evidence

The independent critic reproduced concrete stale-memory, reference, provenance, consent, recovery and onboarding faults; those cases have focused fixes and regressions. Final artifact handling preserves immutable findings and historical decision reasons. Current workspace state overrides earlier onboarding extraction and as-of administrative findings. A bounded critic can still request human attention; unresolved blocking issues prevent application.

Earlier failed browser runs exposed ambiguous alert locators and fixture setup before hydration; the final clean run corrected those harness defects. The duplicate nested profile alert was also removed. No accessibility rules or product thresholds were suppressed to obtain a pass. PDF handover was regenerated, rendered and visually checked as one page with three working link annotations. Source packaging checks committed-tree integrity, excluded private/build files, credential-shaped content and actual local credential values.
