# Orbit GTM Studio

A founder workspace for a go-to-market strategy and a transparent 30-day action plan. Record five commercial decisions, see them modelled (readiness, assumption map, channel bullseye, evidence ladder, positioning, sizing), run focused experiments, and retain your progress.

**v4** ships three interfaces over one product — **Observatory** (instrument panel), **Ledger** (editorial dossier) and **Flow** (the Black Orbit loop as a graph) — in **English, Russian and Kazakh**. Switch both from the *Display* control in any header, or share `?ui=observatory|ledger|flow&lang=en|ru|kk`. The design contract and research are in [docs/design/CRAFT-PLAYBOOK.md](docs/design/CRAFT-PLAYBOOK.md).

Independent developer-test implementation for the AI Startify ecosystem. All demonstration content is synthetic. Strategy completeness and completed tasks are not commercial validation.

[Live review candidate](https://orbit-gtm-studio.vercel.app) · [Seeded Fieldnote profile](https://orbit-gtm-studio.vercel.app/startups/11111111-1111-4111-8111-111111111111). Delivery status is recorded in [SUBMISSION.md](docs/SUBMISSION.md).

## Run locally

Requires Node.js 24 (Node 22.13+ supported). No cloud account or paid AI provider is needed for local development.

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

Next.js App Router, React, strict TypeScript, Zod, PostgreSQL through `pg`, PGlite for local development/tests, Motion, Lucide, and self-hosted Space Grotesk (headings), Montserrat (body, Cyrillic) and JetBrains Mono (data) — the Black Orbit type pair; Space Grotesk has no Cyrillic, so Russian/Kazakh headings fall back to Montserrat by design. The optional owner-gated AI backend uses the official OpenAI Agents SDK and Responses API; the original rule-based workspace runs without a paid key.

## AI specialists

The owner's additional AI scope is implemented through six specialists: brief interpreter, researcher/comparator, GTM strategist, monetization specialist, experiment designer and evidence critic. They use structured artifacts, real web research, a scenario calculator, persistent messages, bounded critique/revision, usage accounting and explicit reviewed application. A rule-generated roadmap is never represented as an AI response.

Agent contract 3.0 (v4) adds structured insights rendered as models in the AI team page: buyer **personas** with jobs-to-be-done, pains, gains, triggers, objections and budget owner; **positioning** by April Dunford's components with a category style; **channel scoring** over the Bullseye/Traction set (ICE, rings, first test, cost note, Kazakhstan channels such as Kaspi, Telegram, 2GIS, goszakup); **bottom-up sizing** (account unit, low/high accounts, annual value, serviceable share, year-one reach) where numbers stay null unless a captured source or the founder supports them; and **pricing research** (anchors from captured pages, tiers, Van Westendorp questions, one commitment test). Research covers competitors, substitutes and do-nothing, pricing pages, market statistics, buyer gathering places and local purchasing/regulation (6 searches, 9 captured pages). The founder answers the intake *before* a run; specialists never ask to fill fields afterwards — unknowns become explicit, testable assumptions. Every specialist writes in the founder's interface language.

Set `OPENAI_API_KEY` and a long random `AI_ACCESS_CODE` server-side to enable paid work. Optional `OPENAI_MODEL`, `OPENAI_CRITIC_MODEL`, `AI_RUN_BUDGET_USD` and `AI_DAILY_BUDGET_USD` are documented in `.env.example`. No key or access code belongs in a browser bundle or shared URL. Public demo profiles and accepted strategy remain shared; AI briefs/observations/history are owner-gated. This is a single-owner gate, not commercial tenant authentication.

The integrated studio compares relevant competitors, indirect alternatives and the current workflow on case-specific axes. It retains captured passages and limitations, versioned hypotheses and decisions, counter-evidence and reopening conditions. A plan preview reconciles earlier suggestions with retained human work, weekly capacity, currency budgets and dependencies before applying one active plan. Six private information displays can be reordered, resized, collapsed or hidden independently of the public dashboard.

See [AI-BACKEND.md](docs/AI-BACKEND.md) for the graph, role prompts, typed messages, endpoint payloads, memory, evidence semantics, model/cost settings and checkpoint recovery. `npm run test:ai:live` performs an explicitly paid synthetic evaluation and is excluded from CI. On Windows with an enterprise certificate store, use Node's `--use-system-ca`; never disable TLS verification.

Font copyright and license notices are retained in [Inter OFL](docs/licenses/Inter-OFL.txt) and [Space Grotesk OFL](docs/licenses/Space-Grotesk-OFL.txt). Reference research and asset provenance are recorded in [the design documents](docs/design/JOURNEY.md). Mozilla PDF.js (Apache-2.0) and fflate (MIT) extract attachment text locally; the PDF worker and its license are copied from the pinned dependency at build time.

```text
src/app/             Next.js pages, layouts and API route handlers
src/ui/              v4 display layer: i18n (EN/RU/KK), versions, kit, visual models, screens, landing
src/components/      Shared editors (strategy, roadmap, onboarding, AI team) and the workspace shell
src/lib/domain/      Shared validation, types, completeness, roadmap rules and the insight engine
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

The roadmap uses predefined rules to generate 8–10 current suggestions depending on saved fields and channels. Every suggestion includes a week, deliverable, rationale and status. Generation reconciles stable rule keys. It preserves statuses, founder edits, custom tasks and completed content; superseded suggestions remain in history. Tasks are written in the founder's language (EN/RU/KK); refreshing in another language rewrites only untouched, unfinished suggestions.

The **insight engine** (`src/lib/domain/insights.ts`) is deterministic and explainable — every score lists the rules behind it, and nothing is marked validated:
readiness radar (six axes scored by specificity checks: a named role, a sized segment, a timed trigger, a measurable outcome, a named alternative, a typed proof, a threshold, a currency, a commitment test…), assumption map (importance × evidence; desirability/viability/feasibility after Bland, including assumptions the strategy implies but does not state), channel bullseye (Weinberg's rings with ICE scores and local notes), evidence ladder (opinion → interest → meeting → commitment → deposit → paid pilot → repeat, raised only by completed tests), positioning statement (Dunford's components from the founder's own words), bottom-up sizing (founder accounts × parsed annual price) and 30-day load.

## Using the workspace

Three interface versions share data, routes and editors and differ in composition, navigation, density and motion ([playbook](docs/design/CRAFT-PLAYBOOK.md)):

- **Observatory** — dark instrument panel: orbit-dial rail, readouts, radar and bullseye; landing with a ray-traced black hole (Schwarzschild-approximation lensing, photon ring, Doppler beaming) seen ~9° above the disk.
- **Ledger** — light paper dossier: masthead tabs, ruled entries with margin notes, a dashboard written as chapters (§1–§11) with a scroll-spy contents rail, small multiples; landing with an engraved orbit plate.
- **Flow** — operator board: the loop as a stage bar, the overview as a node graph (profile → decisions → assumptions → weeks → evidence → next decision) with drawn edges, a sticky inspector on the dashboard.

Language, interface and theme are device preferences (cookies), rendered on the server with the correct `<html lang>`.

- **Two ways to start** ([journey spec](docs/design/JOURNEY.md)). *Free form*: write in your own words; labelled local rules extract what they can. Optional owner-only AI interpretation reads the actual text before creation. Clarification asks only for required gaps, at most seven questions, and stops once they are filled. *Guided brief*: seven freely revisitable topics. Both paths read text from PDF/DOCX/PPTX/TXT/MD/CSV on the device (3 files, 5 MB each, up to 20,000 extracted characters each). PDF reading is capped at 30 pages; scans, images/charts and slide notes are not interpreted. The UI retains coverage, truncation and errors. All fields are confirmed before creation; saved profile edits supersede earlier extraction.
- **Launch sequence** — real completion states for profile, material, unsaved drafts, rule plan and optional AI work. Paid specialists require an explicit choice; an unlocked cookie alone does not start them. Creation and AI attempts retain idempotency keys across network failures and reloads. The full guided answers and extracted material enter the private frozen AI input. "Open workspace now" remains available; a saved launch can resume or start another startup.
- **AI specialists** (`/startups/:id/ai`) — owner-gated studio over the [AI backend](docs/AI-BACKEND.md): live progress by role, the critic's review, proposals compared side by side with the saved section and applied one section at a time, experiment plan added to the roadmap on request. Nothing is applied or called validated automatically.
- **Orbit dial** — inner ring: the five strategy sections (filled when complete, dotted when drafted); outer ring: the 30 plan days lit by finished work; satellite: today's plan day, counted from when the plan was generated. Each ring segment on Overview links to its section.
- **Strategy** is a writing surface: autosave after a pause in typing (switchable per device; conflicts stop it and ask), a live list of missing inputs that jumps to the field, and optional clearly-labelled synthetic examples with a one-click "Use".
- **Dashboard** — completion (formula shown), saved decisions, field-level gaps, suggested next steps ranked by how many readiness points each would add, then every model with its explanation and provenance chip (`rules`, `founder`, `AI`).
- **Roadmap** — a four-week board: drag a task to another week, tick its ring to mark it done, or switch to a compact list. Phones get a stacked timeline.
- **Ctrl/⌘ K** opens a command menu for every screen, section, open task, interface version and language; `G` then `O`/`S`/`D`/`R`/`A` switches screens.
- **Rules understand Russian and Kazakh briefs** without AI: name, who pays, stage, city/country, segment, price in tenge, channels such as Instagram, WhatsApp, Telegram, Kaspi and 2GIS.
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
| `/startups/:id/ai` | Owner-only research, hypothesis/decision memory, evidence and reviewed proposals |
| `/startups/:id/agents` | Redirect to the canonical AI studio |
| `/api/intake` | Owner unlock and optional pre-creation AI interpretation; extracted text only |
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

The full browser suite starts its own loopback server on port 3000; stop a development server using that port first. Its API, desktop and phone projects model separate clients behind a trusted proxy, retaining the real 60-creations/hour limit for each. Every local run uses a fresh `.data/e2e/<timestamp>` database unless `E2E_PGLITE_DATA_DIR` is explicitly set. Synthetic AI acceptance fixtures exercise actual SQL and HTTP application without a provider call. Preflight UI provider responses are explicitly mocked; real API evaluation is separate.

`build` also packages public/static assets with Next's standalone server. `npm start` runs that exact entry point, as does the container. Set runtime environment variables when starting it; local embedded storage in a production build is allowed only for isolated tests. Set `E2E_BASE_URL` to test an already-running synthetic demo instead of starting the local test server. The acceptance suite creates synthetic workspaces and changes their data, so use it only on a demo/test deployment.

With the server running, `npx tsx --conditions=react-server scripts/smoke.ts` exercises the real HTTP API and creates one synthetic acceptance workspace. Set `SMOKE_BASE_URL` explicitly to run this check against a deployed demo. It saves all five sections, checks 100% completion, generates a plan, preserves a done task through regeneration, and verifies JSON export.

## Deployment and handover

See [DEPLOYMENT.md](docs/DEPLOYMENT.md), [HANDOVER.md](docs/HANDOVER.md), and [SUBMISSION.md](docs/SUBMISSION.md). The repository includes Vercel configuration, a standalone Dockerfile, and Docker Compose with PostgreSQL 17.

## Known boundaries

Authentication is deliberately omitted. Every workspace is a clearly labelled public demo: anyone with a link can view and edit its synthetic data. UUID links are identifiers, not access control. Concurrent writes use revision checks and return a recoverable conflict instead of silently overwriting work.

No delete control is offered; skip/archive retains task history. Live AI generation is opt-in and separately owner-gated. Payment processing, investor dashboard and private Black Orbit integration are not included. Integration into a commercial product would require tenant authentication, agreed API/data boundaries and code-usage terms.
