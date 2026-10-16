# Orbit GTM Studio handover

Orbit GTM Studio is a standalone synthetic-data prototype. It helps a founder record five GTM decisions and convert them into a transparent 30-day plan. Strategy completeness means required inputs are filled; commercial assumptions remain untested.

The owner's additional AI scope uses six OpenAI specialists, hosted research, a deterministic scenario calculator and a bounded critic/correction loop. Runs, snapshots, typed messages, artifacts, evidence, usage and reviewed before/after applications persist in PostgreSQL. All AI data and paid actions require an owner access cookie. The original public demo remains synthetic and shared; accepted proposals become part of it. Read [AI-BACKEND.md](AI-BACKEND.md) for the complete backend/frontend contract, runtime limits and honest recovery boundaries. Claude is independently revising the design under the owner's direction.

The application uses Next.js App Router, React and strict TypeScript. Shared Zod schemas, completeness logic, layout validation and roadmap rules live in `src/lib/domain`. UI pages use interactive components backed by same-origin JSON route handlers. Route handlers validate requests and delegate business operations to `Store`; they never expose database credentials to the browser.

Persistence uses PostgreSQL tables for profiles, independently saved strategy sections, tasks and revisions. A PGlite adapter runs the same SQL for local development and tests. Production requires `DATABASE_URL`; there is no browser-storage replacement or silent serverless fallback. Migrations and seed data are idempotent. The prefilled Fieldnote example is synthetic.

Roadmap generation produces 8–10 current suggestions through predefined rules. Stable rule keys reconcile changes; completed content, statuses, founder edits and custom tasks survive regeneration. Superseded tasks are retained as history. Each suggestion exposes a rationale and deliverable. Optimistic revision checks prevent silent concurrent overwrites.

Personalization includes profile context/custom fields and database-persisted theme, density, motion, accent and dashboard layout. The layout schema validates plate identities, allowed sizes and the mandatory readout. Customization must retain access to required dashboard decisions, gaps and next actions.

The public demo intentionally omits authentication. All screens must state that anyone with the link can view/edit the synthetic workspace. Before commercial integration, introduce tenant ownership, authentication/authorization, separate development/production data, and agreed data/API boundaries. Black Orbit's private infrastructure is not a dependency. Keep the domain services and rule engine as the integration boundary rather than coupling UI code to another product's database.

Verification combines domain, SQL and HTTP integration tests, durability after closing/reopening the engine, PostgreSQL 17 CI, production builds and desktop/mobile browser acceptance. Design evidence and independent critique are retained under `docs/design`; implementation issues are tracked on GitHub.

Deploy to Vercel with PostgreSQL/Supabase, or use the included standalone container. See DEPLOYMENT.md for environment and readiness checks, CONTRACT.md for the data/API contract, and SUBMISSION.md for the final public links and any remaining limitations.
