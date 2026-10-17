# Orbit GTM Studio — final submission

The v4 solution is published on Vercel through [PR13](https://github.com/Eye172/dev-test-assignment-1/pull/13), merged as `ecf3e225d52a067b067d82225f561273ff604cd1`. The full application tree was verified at `780bdd893714004e178811d3f0a6d3d7187f1afa`. Current evidence and limitations are in [the final release record](RELEASE-2026-10-17.md); earlier milestone documents remain historical.

- [Public application](https://orbit-gtm-studio.vercel.app/)
- [Prefilled synthetic Fieldnote example](https://orbit-gtm-studio.vercel.app/startups/11111111-1111-4111-8111-111111111111)
- [GitHub repository](https://github.com/Eye172/dev-test-assignment-1), private: provide the included source ZIP or reviewer repository access.
- [Local setup and route map](../README.md), [assignment mapping](ASSIGNMENT-CHECK.md), [schema/API](CONTRACT.md), [AI implementation](AI-BACKEND.md), [deployment](DEPLOYMENT.md).
- [One-page handover](../output/pdf/orbit-gtm-studio-handover.pdf), rendered and checked: one page, three link annotations.

## Verification

Lint, strict TypeScript, production build and 93 domain/SQL checks pass. The complete local browser suite passes 100/100 with no retries. [PostgreSQL 17 CI](https://github.com/Eye172/dev-test-assignment-1/actions/runs/39032050380) passes all 93 domain/SQL and 100 browser checks. The public Vercel alias passes 32 anonymous HTTP/desktop/phone checks; two isolated-code AI checks are intentionally excluded from hosted testing. Actual hosted AI preflight and owner unlock/lock were separately checked manually.

[Seventeen manual scenarios](verification/final-2026-10-17/manual.json) cover ten different startup cases, guided/free-form/materials, B2B/B2C/B2G, three stages, validation, independent saves, task history, languages, responsive layout, real provider output and capacity blockers. [The workspace index](verification/final-2026-10-17/ten-startups.json) distinguishes local and hosted records. Production dependency audit reports zero vulnerabilities. No accessibility rules were suppressed.

The original six-screen assignment remains available without paid AI. Five sections save independently; completeness is complete sections / 5. Channels are capped at three, market assumptions are exactly three, and the rule plan produces 8–10 current suggestions while preserving completed/custom work. Neither forms nor task completion establish market validation.

## Delivery files

Run `python scripts/package-submission.py --output-dir ../submission-final-2026-10-17` using the documented Python dependencies after committing delivery changes. The folder contains the committed-tree source ZIP, matching PDF, SOURCE-REVISION.txt, SUBMISSION.txt and SHA256SUMS.txt. The packager checks archive integrity, excluded private/build files, actual local credentials and key-shaped content; it separately scans the client bundle for actual server credentials.

The package is prepared for the owner to submit. It has not been sent to an external evaluator.

## Boundaries

This is a synthetic shared demo: public profile/strategy/task links permit editing. AI material/history has an owner signed-cookie gate rather than multi-tenant authentication. No payment processing or private Black Orbit integration is included.

Paid AI is real and optional. A real experiment/critic follow-up completed and applied eight conditional tasks; another full run timed out and a later attempt stopped at the daily reservation limit. No new successful six-specialist run is claimed. Unknown resources, unsupported claims and provider errors remain visible; uncertain calls are not automatically repeated. The final hosted preflight separately confirmed actual model-generated questions, correct paid-stage extraction, preserved GBP pricing and no invented customer benefit.

The local rules-only reader is approximate and requires confirmation. File extraction reads text/XML, without OCR, images/charts or speaker notes. Work resumes from saved checkpoints when the studio is reopened; it is not an external background queue. Docker is supplied but was not executed on this Windows host. Mobile checks use Chromium emulation rather than physical-device certification.
