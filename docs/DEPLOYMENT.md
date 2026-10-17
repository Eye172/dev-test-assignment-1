# Deploy Orbit GTM Studio

## Vercel with PostgreSQL or Supabase

The current dedicated infrastructure is the free `orbit-gtm-studio-db` Neon database in Frankfurt, connected through the existing Vercel integration. `vercel.json` pins functions to Frankfurt (`fra1`) beside that database; static assets remain CDN-served. If relocating the database, update the function region too. See [Vercel's region configuration](https://vercel.com/docs/functions/configuring-functions/region).

The dedicated Vercel project is `orbit-gtm-studio`, with public production alias https://orbit-gtm-studio.vercel.app. The release production branch is `main` (Vercel Settings → Environments → Production → Branch Tracking). The temporary implementation-branch deployment is replaced during final release. Neon supplies sensitive `DATABASE_URL` automatically for Production/Preview; `DEMO_MODE=true` and `TRUST_PROXY=true` are configured for both. Release-specific CI, hosted checks and actual AI outcomes are recorded in SUBMISSION.md; earlier hosted results do not establish that a newer candidate is deployed.

1. Import `Eye172/dev-test-assignment-1` as a Next.js project. Use Node.js 24, the repository root, `npm ci`, and `npm run build`.
2. Provision a separate database for synthetic demo data. For Supabase, use the Connect panel's session pooler URI when IPv4 compatibility is required; use the provider's documented TLS settings. Vercel server instances use a small `pg` pool.
3. Configure `DATABASE_URL` as a sensitive server-only variable, `DEMO_MODE=true`, and `TRUST_PROXY=true`. Never prefix database credentials with `NEXT_PUBLIC_`. Leave `ALLOW_LOCAL_DATABASE` unset/false. `APP_ORIGIN` can remain blank so previews and the production domain each check their own request origin.
4. Optionally configure server-side `OPENAI_API_KEY` and a long random `AI_ACCESS_CODE`, with `OPENAI_MODEL`, `OPENAI_CRITIC_MODEL`, `AI_RUN_BUDGET_USD` and `AI_DAILY_BUDGET_USD` as documented in .env.example. Keep them out of public variables. AI uses the same PostgreSQL migration path and signed owner cookie.
5. Deploy the verified `main` commit. `/api/health` must return `status: ready` and `database: postgres`.
6. Open `/api/demo` once to initialize the synthetic Fieldnote example. The direct seeded profile is `/startups/11111111-1111-4111-8111-111111111111`. The welcome page can create separate demo working copies.
7. Test the public deployment in a signed-out browser. Disable deployment protection for the submitted demo only if it prevents reviewers opening it. Verify startup creation, five saved sections, refresh/direct links, roadmap generation and status persistence.
8. Record the actual production and demo URLs in SUBMISSION.md. Do not present a preview behind authentication as the public submission.

GitHub/Vercel access is handled through the owner's existing account. New provider authorization, account agreements, or paid resources must be resolved explicitly; no credentials should be posted to issues or chat.

## Standalone container

```sh
docker compose up --build
```

This starts the web app at http://localhost:3000 and PostgreSQL 17 with a persistent named volume. The default `orbit-local-only` database password is a local development fixture; set `POSTGRES_PASSWORD` for a deployed environment. Do not expose the database port to the internet.

The Dockerfile builds Next.js standalone output and runs as a non-root user. Supply `DATABASE_URL`, `DEMO_MODE=true`, and any origin/proxy settings at runtime. Use HTTPS through the hosting platform or reverse proxy. The health check is `/api/health`.

Docker was not available on the development machine, so the image itself was not executed there. The packaged standalone Node server, PostgreSQL 17 CI and actual Vercel/Neon deployment were executed and verified.

## Operational notes

- Startup/schema initialization and roadmap reconciliation use transactions. PostgreSQL advisory locks serialize migration/seed setup across server instances.
- Back up the PostgreSQL database through the provider. A user can also export a workspace as JSON.
- PGlite is for local development and tests; a writable persistent directory and a single Node process are necessary. Serverless public deployments always require remote PostgreSQL.
- The API uses bounded JSON inputs, schema validation, same-origin write checks, parameterized SQL, revision conflicts, request limits and non-sensitive error responses. No production account/user data belongs in this demo.
- PostgreSQL's application connection role must own the application tables or have the required server-only privileges. Do not grant anonymous browser roles direct table access.

## Official provider references

- [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)

## AI operation

The server accepts and checkpoints paid work through route-handler after() tasks. Each worker has a lease and returns at a bounded checkpoint; opening the studio/launch resumes queued work through the explicit resume endpoint. This is visitor-driven continuation, not an external durable queue. An ambiguous provider outcome is never billed again automatically. Reported usage is settled exactly once; uncertain reservations remain for owner review.

Pre-creation interpretation has a separate one-call worker and shares the daily AI budget. The interface distinguishes local extraction, paid interpretation and a full specialist run. Missing configuration leaves the complete rule-based journey available. The same-origin PDF worker and license are generated by predev/prebuild, then copied into standalone output; no external worker CDN is required.

Migrations add evidence/memory/plan and intake tables without deleting previous data. A deployment with incompatible prompt/tool/artifact execution settings cannot replay an old unfinished step: start a follow-up from its saved artifacts. Public profile export excludes AI material; use the owner-only export for an auditable AI backup. Keep provider dashboards and database backups available for reconciling interrupted calls.
