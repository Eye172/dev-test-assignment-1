# Orbit GTM Studio submission package

Repository: https://github.com/Eye172/dev-test-assignment-1

Delivery source: [main](https://github.com/Eye172/dev-test-assignment-1/tree/main), integrated through [delivery PR #4](https://github.com/Eye172/dev-test-assignment-1/pull/4). The active-work frontend revision and safety reconciliation are recorded in [PR #6](https://github.com/Eye172/dev-test-assignment-1/pull/6); the concrete welcome experiment example is in [PR #7](https://github.com/Eye172/dev-test-assignment-1/pull/7).

Live application: https://orbit-gtm-studio.vercel.app

Direct demo startup: https://orbit-gtm-studio.vercel.app/startups/11111111-1111-4111-8111-111111111111

Setup, schema, route map and environment: [README](../README.md).

Architecture and integration handover: [HANDOVER.md](HANDOVER.md).

One-page reviewer handover: [PDF](../output/pdf/orbit-gtm-studio-handover.pdf). Regenerate with `python scripts/build-handover.py` (requires ReportLab).

Verified 16 October 2026: 23 domain/SQL/API tests, lint, types and standalone production build pass. [PostgreSQL 17 CI](https://github.com/Eye172/dev-test-assignment-1/actions/runs/38948506396) passes 67 HTTP/desktop/phone scenarios without retries, with one deliberate phone pointer-drag skip. The public Vercel/Neon deployment reports ready/postgres/demo and passes 24 selected hosted checks, including the complete six-screen flow at both sizes, data persistence, export, editing, archive/restore, delayed saves/JavaScript, keyboard controls, all accessibility audit states and the welcome preview without JavaScript or motion. No Vercel login is needed on the production alias.

The source ZIP accompanies the submission alongside this one-page PDF and checksums. It is generated from the committed tree and excludes local environment files, databases, dependencies and build output. The packaging step verifies archive integrity, PDF page/link count and credential-shaped content.

Frontend remake (branch `claude/remake`, 17 October 2026): every screen was rebuilt around the Orbit dial, a floating navigation rail/dock, a writing-surface strategy editor with optional autosave, drag-and-resize dashboard plates with presets, a draggable four-week roadmap board and a Ctrl/Cmd+K command menu. Review of the previous UI and the direction: [REMAKE.md](design/REMAKE.md); desktop/phone light/dark captures: `docs/design/evidence/remake/`. Verified locally on the production build: `npm run verify` passes and the browser suite passes 71 scenarios (API, desktop, phone) with one deliberate phone pointer-drag skip, including the full accessibility audit with no suppressed rules. Hosted checks must be re-run after this branch is deployed; until then the live link serves the previous `main` UI.

Earlier design evaluation is recorded honestly in [INTEGRATION-REVIEW.md](design/INTEGRATION-REVIEW.md): the independent targeted review found no concrete release blocker and rated the aesthetic result approximately 7.5/10. The refined welcome now connects a synthetic customer problem to an actual roadmap rule, interview task and evidence to collect. It is readable without JavaScript and honors reduced motion. Testing used Chromium desktop/phone emulation, not physical-device performance certification. The provided Docker configuration was not executed on the local machine because Docker was unavailable; the exact standalone Node server and real hosted PostgreSQL flow were executed.

Source review: the repository is private. Supply the included source ZIP, or grant the evaluator repository access before relying on the GitHub link. A public demo does not grant source access. This package is prepared for the owner to submit; it has not been sent to an external evaluator.

Known boundaries: explicitly labelled synthetic demo with no authentication; shared links permit viewing/editing. No private Black Orbit access, paid AI dependency, billing or investor dashboard. See README for details.

Deadline stated in the assignment: Saturday, 17 October 2026, 23:59 UTC+5. All links must be independently accessible to the reviewer; clearly disclose any incomplete elements in the final message.
