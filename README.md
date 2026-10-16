# Orbit GTM Studio

A founder workspace for a go-to-market strategy and a transparent 30-day action plan. Record five commercial decisions, see what is missing, run focused experiments, and retain your progress.

Independent developer-test implementation for the AI Startify ecosystem. All demonstration content is synthetic. Strategy completeness and completed tasks are not commercial validation.

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

Next.js App Router, React, strict TypeScript, Zod, PostgreSQL through `pg`, PGlite for local development/tests, Motion, Lucide, and self-hosted Inter/Space Grotesk. No paid AI dependency.

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

## Verify

```sh
npm run verify
npx playwright install chromium
npm run test:e2e
```

`verify` runs ESLint, strict type checking, domain/SQL/API tests and a production build. The browser suite runs the production build at desktop and mobile sizes. GitHub Actions additionally runs the SQL/API suite against PostgreSQL 17. Tests require an isolated database and use in-memory PGlite locally; an on-disk test also closes and reopens the engine to verify durability.

## Deployment and handover

See [DEPLOYMENT.md](docs/DEPLOYMENT.md), [HANDOVER.md](docs/HANDOVER.md), and [SUBMISSION.md](docs/SUBMISSION.md). The repository includes Vercel configuration, a standalone Dockerfile, and Docker Compose with PostgreSQL 17.

## Known boundaries

Authentication is deliberately omitted. Every workspace is a clearly labelled public demo: anyone with a link can view and edit its synthetic data. UUID links are identifiers, not access control. Concurrent writes use revision checks and return a recoverable conflict instead of silently overwriting work.

No delete control is offered; skip/archive retains task history. No live AI strategy generation, billing, investor dashboard or private Black Orbit integration is included. Integration into a commercial product would require agreed API, authorization and code-usage terms.
