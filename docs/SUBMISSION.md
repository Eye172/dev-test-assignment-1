# Orbit GTM Studio submission package

Repository: https://github.com/Eye172/dev-test-assignment-1

Integrated source is currently on [gpt/implementation](https://github.com/Eye172/dev-test-assignment-1/tree/gpt/implementation), with [delivery PR #4](https://github.com/Eye172/dev-test-assignment-1/pull/4) open into `main` while the frontend revision is reviewed.

Live review candidate: https://orbit-gtm-studio.vercel.app

Direct demo startup: https://orbit-gtm-studio.vercel.app/startups/11111111-1111-4111-8111-111111111111

Setup, schema, route map and environment: [README](../README.md).

Architecture and integration handover: [HANDOVER.md](HANDOVER.md).

One-page reviewer handover: [PDF](../output/pdf/orbit-gtm-studio-handover.pdf). Regenerate with `python scripts/build-handover.py` (requires ReportLab).

Verified 16 October 2026: 23 domain/SQL/API tests, lint, types and standalone production build pass. PostgreSQL 17 CI is green. Hosted candidate `076a6ff` reports `ready/postgres/demo` and passes 17 API/desktop/phone scenarios plus two profile/custom-context/direct-link scenarios. No Vercel login is needed on the production alias. Additional draft-safety regressions and the frontend composition/motion revision are being integrated; this is a review candidate, not final design acceptance.

Source review: the repository is private. Confirm the evaluator has access before submitting the source link. Do not assume a working public demo grants source access.

Known boundaries: explicitly labelled synthetic demo with no authentication; shared links permit viewing/editing. No private Black Orbit access, paid AI dependency, billing or investor dashboard. See README for details.

Deadline stated in the assignment: Saturday, 17 October 2026, 23:59 UTC+5. All links must be independently accessible to the reviewer; clearly disclose any incomplete elements in the final message.
