# Orbit GTM Studio implementation contract

## Purpose and scope

An independent synthetic-data demo helping founders record a GTM strategy and act on it for 30 days. Required pages: /, /startups/new, /startups/:id, /startups/:id/strategy, /startups/:id/dashboard, /startups/:id/roadmap. No paid AI, payments, investor dashboard or private Black Orbit integration. Authentication is omitted deliberately; every screen labels Demo mode and explains that shared demo URLs contain non-sensitive data and allow editing.

## Roles

GPT implements and integrates the entire application. Claude owns official visual-reference research, frontend design specification, and UX/motion evaluation. Design documents live in docs/design. The owner's preferences: simple, flexible, personal, adaptable, fluid, accessible. Required inputs cannot be removed; incomplete strategy drafts can be saved without completing a forced wizard.

## Data and naming

Shared runtime schemas and TypeScript types live in src/lib/domain. JSON uses camelCase. IDs are UUIDs. All mutation responses include the updated record and revision. Dates are ISO strings.

Startup: name, description, businessModel (B2B/B2C/B2G), stage (Idea/MVP/Early Traction), targetMarket, customerSegment, websiteUrl (optional valid http/https URL), context (optional), customFields (optional string map), preferences ({theme: dark/light/system, density: comfortable/compact, motion: full/reduced, accent: green/lime/blue, dashboardLayout: null | {version: 1, plates: [{id,size,hidden}]}}). Required profile fields must be valid on creation/update. Startup id, revision, createdAt, updatedAt are server-owned.

Dashboard layout is database-backed. `null` restores the authored default. Every version-1 layout contains exactly the eight known plate IDs, once each: readout, next, decisions, gaps, week, risks, channels, profile. Sizes are S/M/L/XL as allowed by `src/lib/domain/dashboard.ts`. The readout cannot be hidden. Unknown IDs, duplicates, missing plates, invalid sizes and hidden readouts are rejected. The frontend must retain a compact mandatory strategy/gaps/next-actions summary outside the hideable plates, so personalization never hides required assignment information. Grid order follows DOM order; phones use one column and explicit move controls. Layout changes are saved through the existing profile preferences PATCH and revision protection.

Strategy keys and draft data:

- icp: buyerType, industry, painPoint, buyingTrigger.
- value: problem, outcome, differentiation, proof.
- channels: channels [{name, reason}] (maximum three), firstExperiment.
- pricing: model, initialPrice, paymentUnit, rationale. initialPrice is a textual assumption, supporting ranges, free pilots and usage pricing.
- assumptions: assumptions [{statement, risk: low/medium/high, validationMethod}] (maximum three; exactly three complete entries for completeness).

Every section also accepts notes. Empty strings/arrays are valid drafts. Completeness is calculated centrally and returns missing fields and actionable suggestions. Blank whitespace never counts. A complete channels section needs at least one fully described channel plus an experiment. Completed sections / 5 * 100 is the sole strategy percentage.

Roadmap task: id, startupId, ruleKey (null for custom), title, deliverable, rationale, week (1–4), status (todo/in_progress/done/skipped), notes, source (generated/custom), archived, revision, createdAt, updatedAt. User may edit title, deliverable, week, notes and status. Regeneration preserves these edits and statuses, keeps completed content unchanged, archives superseded rules without deletion, and retains custom tasks. A current generated plan contains 8–10 suggestions; historical and custom tasks can increase the overall count.

## HTTP contract

Same-origin JSON API. Success {data: T}; error {error: {code, message, fields?}}. Errors: 400 malformed JSON, 413 oversized request, 415 wrong content type, 422 invalid inputs, 404 missing record, 409 revision conflict, 429 limit, 503 unavailable database. API responses are no-store. Optional request Origin must match the application origin on writes.

| Method | Route | Input / result |
| --- | --- | --- |
| GET | /api/health | readiness and database mode, no credentials |
| GET | /api/demo | initialized synthetic demo workspace metadata |
| POST | /api/demo | create a private-to-the-link working copy of the seeded demo (public demo access model, no authentication) |
| POST | /api/startups | validated profile; returns startup |
| GET | /api/startups/:id | aggregate workspace: startup, sections, completion, tasks, roadmapProgress |
| PATCH | /api/startups/:id | {expectedRevision, patch: profile/preferences changes} |
| PUT | /api/startups/:id/strategy/:section | {expectedRevision, data, notes?}; initial section revision is 0 |
| POST | /api/startups/:id/roadmap | no body required; reconcile saved strategy into roadmap |
| POST | /api/startups/:id/tasks | {title, deliverable, week, notes?}; custom task |
| PATCH | /api/startups/:id/tasks/:taskId | {expectedRevision, patch: editable task fields} |
| GET | /api/startups/:id/export | downloadable JSON workspace backup |

No delete controls are offered. Skipping, archiving and editing retain work. Share profile URL works on direct navigation and refresh, independently of browser storage. Preferences persist in the database. Network-failed saves retain the user's draft locally in the mounted form and provide retry; they must never claim success prematurely.

## Verification

Unit tests cover completeness, drafts and roadmap rules. Database/service integration tests use real PGlite SQL including transactions, constraints, conflict detection and regeneration history. HTTP tests cover validation/error handling. Browser acceptance covers creation, all five independent saves, refresh/direct links, dashboard percentages, roadmap generation/status persistence, repeated generation, customization, export, desktop/mobile and keyboard/reduced-motion behavior. CI runs lint, typecheck, tests, production build and browser acceptance.
