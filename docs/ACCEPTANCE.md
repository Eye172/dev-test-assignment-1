# Acceptance map

This checklist follows the supplied Orbit GTM Studio assignment. A row marked pending has not yet passed the corresponding acceptance gate. Backend evidence is separate from browser or deployed evidence.

| Required behavior | Implementation boundary | Evidence |
| --- | --- | --- |
| Welcome page with Create Startup and demo entry | Claude frontend + demo API | Browser pending |
| Validated onboarding, required name/description/model/stage/market/segment, optional valid website | Shared schema, POST /api/startups, profile form | SQL/API tests pass; browser pending |
| Unique shareable profile and editable fields | UUID profile, profile PATCH/revisions | SQL/API tests pass; direct-link browser pending |
| Five independently saved/reopened strategy sections | JSONB sections, per-section PUT | SQL/API/durability tests pass; browser pending |
| ICP: buyer, industry/demographics, pain, trigger | icp schema | Completeness tests pass |
| Value: problem, outcome, differentiation, proof/assumptions | value schema | Completeness tests pass |
| Channels: up to three, each with reason, plus first experiment | channels schema | Custom-name/cap/completeness tests pass |
| Pricing: model, initial price, payment unit, rationale | pricing schema | Text/range support; completeness tests pass |
| Assumptions: three statements, risks and validation methods | assumptions schema | Three-entry completeness tests pass |
| Honest section status; percentage completed/5*100 | Central domain calculation | Whitespace/partial/80%/100% tests pass |
| Dashboard decisions, progress, gaps and next actions | Aggregate workspace + frontend summary/plates | Data tests pass; visual/browser pending |
| Rule-based 30-day plan, 6–10 tasks | Deterministic generator produces 8–10 | Empty/1/2/3-channel deterministic tests pass |
| Each task includes title, week/phase, status and deliverable | Domain/task table/API | SQL/API tests pass |
| User can change statuses and see progress | Task PATCH + aggregate metrics | SQL/API/reopen tests pass; browser pending |
| Regeneration does not destroy completed work | Stable rule reconciliation + retained history | Done/custom/edit/archival/idempotence tests pass |
| Profiles, strategy and roadmap survive refresh | Server PostgreSQL/PGlite persistence | Engine close/reopen test passes; browser refresh pending |
| Loading, empty, validation, error and recovery states | Claude frontend + typed error contract | HTTP error tests pass; visual/browser pending |
| Responsive desktop/mobile and readable typography | Claude frontend/design | Independent rendered review pending |
| Environment credentials, synthetic data, no production keys | Server-only DB, env example, demo fixtures | Manual source review; final secret scan pending |
| Modular schema/routes/integration documentation | src/lib/domain, src/server, docs | Prepared; final code review pending |
| Optional auth omitted with clear demo labeling | Public synthetic demo | Backend mode present; all-screen visual check pending |
| No private systems or paid AI required | Independent rule engine and DB | Local tests/migrations/seed work without providers |
| GitHub source, meaningful commits, sample env | Repository and history | Published implementation branch |
| Public working demo and seeded direct profile | Vercel + dedicated Neon PostgreSQL | Free database provisioned; app deployment pending |
| README and one-page handover | README, docs/HANDOVER.md | Prepared; final URLs/results pending |

## Additional user-directed quality gates

The personal workspace must offer useful customization without concealing required information. Layout preferences persist to the database, and missing/duplicate/invalid plate definitions are rejected. Movable panels need keyboard move controls, a reset and a deliberate phone layout. Inputs remain flexible drafts; working order is not locked.

Motion must be authored for the actual interactions, interruptible, performant and comfortable. Respect system reduced motion and the saved preference. Test real content lengths, keyboard access, draft safety, conflict recovery, mobile sticky controls and dialogs. The independent critique in docs/design/CRITIQUE.md is an open action list until checked against the finished implementation.
