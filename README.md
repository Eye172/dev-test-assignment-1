# Orbit GTM Studio

A founder workspace for a go-to-market strategy and a transparent 30-day action plan. Record five commercial decisions, see what is missing, run focused experiments, and retain your progress.

Independent developer-test implementation for the AI Startify ecosystem. All demonstration content is synthetic. Strategy completeness and completed tasks are not commercial validation.

[Live review candidate](https://orbit-gtm-studio.vercel.app) · [Seeded Fieldnote profile](https://orbit-gtm-studio.vercel.app/startups/11111111-1111-4111-8111-111111111111). Delivery status is recorded in [SUBMISSION.md](docs/SUBMISSION.md).

## Run locally

Requires Node.js 24 (Node 22+ supported). No cloud account or paid AI provider is needed for local development.

```sh
npm ci
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Windows PowerShell: replace `cp` with `Copy-Item .env.example .env.local`.

Open http://127.0.0.1:3000. Local development uses a persistent embedded PostgreSQL engine (PGlite) in `.data/orbit`. Closing the browser or restarting the app does not erase the database. Local database folders are ignored by Git. Do not run two app processes against the same PGlite folder.

For a PostgreSQL/Supabase deployment, set `DATABASE_URL`. Production refuses to substitute local storage for a missing database. The server creates the versioned schema at first connection; migration and seed commands are also provided.

## Stack and structure

Next.js App Router, React, strict TypeScript, Zod, PostgreSQL through `pg`, PGlite for local development/tests, Motion, Lucide, and self-hosted Inter/Space Grotesk. The optional owner-gated AI backend uses the official OpenAI Agents SDK and Responses API; the original rule-based workspace runs without a paid key.

## AI specialists

The owner's additional AI scope is implemented through six specialists: brief interpreter, researcher/comparator, GTM strategist, monetization specialist, experiment designer and evidence critic. They use structured artifacts, real web research, a scenario calculator, persistent messages, bounded critique/revision, usage accounting and explicit reviewed application. A rule-generated roadmap is never represented as an AI response.

Set `OPENAI_API_KEY` and a long random `AI_ACCESS_CODE` server-side to enable paid work. Optional `OPENAI_MODEL`, `OPENAI_CRITIC_MODEL`, `AI_RUN_BUDGET_USD` and `AI_DAILY_BUDGET_USD` are documented in `.env.example`. No key or access code belongs in a browser bundle or shared URL. Public demo profiles and accepted strategy remain shared; AI briefs/observations/history are owner-gated. This is a single-owner gate, not commercial tenant authentication.

See [AI-BACKEND.md](docs/AI-BACKEND.md) for the graph, role prompts, typed messages, endpoint payloads, memory, evidence semantics, model/cost settings, checkpoint recovery and frontend integration requirements. Claude's next design remains independently owned; the backend contract does not prescribe a layout. `npm run test:ai:live` performs an explicitly paid synthetic evaluation and is excluded from CI.

Font copyright and license notices are retained in [Inter OFL](docs/licenses/Inter-OFL.txt) and [Space Grotesk OFL](docs/licenses/Space-Grotesk-OFL.txt). Black Orbit supplies visual inspiration; the orbit mark and application composition are original.

```text
src/app/             Next.js pages, layouts and API route handlers
src/components/      Interactive frontend and workspace composition
src/lib/domain/      Shared validation, types, completeness and roadmap rules
src/server/          Database adapters, transactions, persistence and demo fixtures
tests/               Domain, SQL persistence and HTTP integration tests
e2e/                 Browser acceptance tests
docs/                API contract, design evidence, deployment and handover
.collab/             Ownership, decisions and coordination log
```

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only PostgreSQL connection URL. Required in production. Use the provider's TLS/pooling settings. |
| `PGLITE_DATA_DIR` | Local database directory, default `.data/orbit`. |
| `DEMO_MODE` | Set `true` for this synthetic-data exercise. This release is not a private user-data service. |
| `APP_ORIGIN` | Optional canonical application origin for write-origin checks; leave blank to use the request origin. Set per preview if used. |
| `TRUST_PROXY` | Set `true` only behind a platform that overwrites `x-forwarded-for`, for per-client rate limits. |
| `ALLOW_LOCAL_DATABASE` | Local production-build E2E only. Never enable on Vercel or another public deployment. |
| `TEST_DATABASE_URL` | Explicit isolated test database. Tests never use `DATABASE_URL` implicitly. |

Keep credentials in `.env.local` or the hosting environment. No database credentials are sent to the browser. On Supabase, row-level security denies direct anonymous table access; all application operations go through the server.

## Schema and rules

`startups` stores validated profiles, personal context, preferences and revisions. `strategy_sections` stores one independent JSONB draft per startup/section key. `roadmap_tasks` stores generated and custom tasks, statuses, notes, revisions and retained history. `schema_migrations` records schema versions; `request_limits` bounds demo API traffic. See [schema.ts](src/server/schema.ts) and [the API contract](docs/CONTRACT.md).

Five strategy sections: Ideal Customer Profile, Value Proposition, Acquisition Channels (up to three freely named channels), Pricing & Revenue, and three Market Assumptions. Empty strategy drafts can be saved. Completion is exactly `completed sections / 5 × 100%`, based on required saved inputs, including whitespace handling.

The roadmap uses predefined rules to generate 8–10 current suggestions depending on saved fields and channels. Every suggestion includes a week, deliverable, rationale and status. Generation reconciles stable rule keys. It preserves statuses, founder edits, custom tasks and completed content; superseded suggestions remain in history. Eight dashboard plates can be rearranged, resized and hidden through validated database-backed preferences; the required summary remains visible.

## Using the workspace

The interface is built as "paper and instruments": a light Black Orbit-inspired canvas (dark by preference) with dark instrument objects. Direction and the review of the previous version: [docs/design/REMAKE.md](docs/design/REMAKE.md).

- **Two ways to start** ([journey spec](docs/design/JOURNEY.md)). *Free form*: write in your own words; deterministic rules pick out profile fields and strategy hints (shown live as "Picked up · rules, not AI"), then ask only for what is missing — at most seven questions, none when nothing is missing. *Guided brief*: seven topics with complete option sets (B2B/B2C/B2G plus business type, stage plus signals, market groups, buyer role and size). Both paths accept attached material (plain text is read in the browser; PDF/DOCX/PPTX are kept and labelled as needing AI reading) and end on one confirmation screen that tags where each value came from.
- **Launch sequence** — a non-blocking transition that lights only on real steps: profile saved, material read, unsaved strategy drafts prepared, 30-day plan generated, and (when the owner has unlocked AI) the specialist run from the server journal. "Open workspace now" is available from the first second; the workspace opens on a *Prepared for you* panel.
- **AI specialists** (`/startups/:id/ai`) — owner-gated studio over the [AI backend](docs/AI-BACKEND.md): live progress by role, the critic's review, proposals compared side by side with the saved section and applied one section at a time, experiment plan added to the roadmap on request. Nothing is applied or called validated automatically.
- **Orbit dial** — inner ring: the five strategy sections (filled when complete, dotted when drafted); outer ring: the 30 plan days lit by finished work; satellite: today's plan day, counted from when the plan was generated. Each ring segment on Overview links to its section.
- **Strategy** is a writing surface: autosave after a pause in typing (switchable per device; conflicts stop it and ask), a live list of missing inputs that jumps to the field, and optional clearly-labelled synthetic examples with a one-click "Use".
- **Dashboard** — drag a plate by its grip, drag its right edge to resize (snaps to its allowed sizes), hide plates into a tray, or apply a preset (Default, Focus, Planning, Everything). Rows always fill; every pointer action has a button and keyboard equivalent. Saved in the database.
- **Roadmap** — a four-week board: drag a task to another week, tick its ring to mark it done, or switch to a compact list. Phones get a stacked timeline.
- **Ctrl/⌘ K** opens a command menu for every screen, section, open task and action; `G` then `O`/`S`/`D`/`R`/`A` switches screens; `?` opens preferences (theme, accent, density, motion).
- Motion respects the operating-system reduced-motion setting and the workspace "reduced" preference; content is server-rendered and readable before JavaScript.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Welcome, startup creation CTA and working demo entry |
| `/startups/new` | Startup onboarding and validation |
| `/startups/:id` | Editable profile, strategy and roadmap overview |
| `/startups/:id/strategy` | Five independently saved sections in any order |
| `/startups/:id/dashboard` | Saved decisions, real progress, gaps and next actions |
| `/startups/:id/roadmap` | Editable 30-day tasks, statuses and retained history |
| `/api/health` | Database readiness without credentials |
| `/api/demo` | Seeded example / create a separate demo working copy |
| `/api/startups/:id/export` | Downloadable JSON workspace backup |

The full HTTP route map, inputs and error contract are in [CONTRACT.md](docs/CONTRACT.md). Profile links work directly and after refresh; browser storage is not required to reopen saved work.

Unsaved editor/layout changes have separate per-tab recovery for browser Back/Forward and reload. These recovery copies expire after seven days and retain the original revision, so recovering an old draft cannot silently overwrite a newer database save. Explicit Save/Done (or strategy autosave) persists to PostgreSQL; Cancel/Discard removes the recovery copy. Autosave never retries after a failure or revision conflict; it shows the same recovery choices as an explicit save. Browser storage being unavailable does not prevent database saves or saved direct links.

## Verify

```sh
npm run verify
npx playwright install chromium
npm run test:e2e
```

`verify` runs ESLint, strict type checking, domain/SQL/API tests and a production build. The browser suite runs the production build at desktop and mobile sizes. GitHub Actions additionally runs the SQL/API suite against PostgreSQL 17. Tests require an isolated database and use in-memory PGlite locally; an on-disk test also closes and reopens the engine to verify durability.

The full browser suite starts its own loopback server on port 3000; stop a development server using that port first. Its API, desktop and phone projects model separate clients behind a trusted proxy, retaining the real 60-creations/hour limit for each. This test-only configuration is not applied to an existing deployment. Repeated runs share the local `.data/e2e` database and its hourly quotas; use a fresh isolated test database or wait for the next hour if running the complete suite repeatedly.

`build` also packages public/static assets with Next's standalone server. `npm start` runs that exact entry point, as does the container. Set runtime environment variables when starting it; local embedded storage in a production build is allowed only for isolated tests. Set `E2E_BASE_URL` to test an already-running synthetic demo instead of starting the local test server. The acceptance suite creates synthetic workspaces and changes their data, so use it only on a demo/test deployment.

With the server running, `npx tsx --conditions=react-server scripts/smoke.ts` exercises the real HTTP API and creates one synthetic acceptance workspace. Set `SMOKE_BASE_URL` explicitly to run this check against a deployed demo. It saves all five sections, checks 100% completion, generates a plan, preserves a done task through regeneration, and verifies JSON export.

## Deployment and handover

See [DEPLOYMENT.md](docs/DEPLOYMENT.md), [HANDOVER.md](docs/HANDOVER.md), and [SUBMISSION.md](docs/SUBMISSION.md). The repository includes Vercel configuration, a standalone Dockerfile, and Docker Compose with PostgreSQL 17.

## Known boundaries

Authentication is deliberately omitted. Every workspace is a clearly labelled public demo: anyone with a link can view and edit its synthetic data. UUID links are identifiers, not access control. Concurrent writes use revision checks and return a recoverable conflict instead of silently overwriting work.

No delete control is offered; skip/archive retains task history. Live AI generation is opt-in and separately owner-gated. Payment processing, investor dashboard and private Black Orbit integration are not included. Integration into a commercial product would require tenant authentication, agreed API/data boundaries and code-usage terms.
