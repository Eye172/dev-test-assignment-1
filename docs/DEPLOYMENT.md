# Deploy Orbit GTM Studio

## Vercel with PostgreSQL or Supabase

1. Import `Eye172/dev-test-assignment-1` as a Next.js project. Use Node.js 24, the repository root, `npm ci`, and `npm run build`.
2. Provision a separate database for synthetic demo data. For Supabase, use the Connect panel's session pooler URI when IPv4 compatibility is required; use the provider's documented TLS settings. Vercel server instances use a small `pg` pool.
3. Configure `DATABASE_URL` as a sensitive server-only variable, `DEMO_MODE=true`, and `TRUST_PROXY=true`. Never prefix database credentials with `NEXT_PUBLIC_`. Leave `ALLOW_LOCAL_DATABASE` unset/false. `APP_ORIGIN` can remain blank so previews and the production domain each check their own request origin.
4. Deploy the verified `main` commit. `/api/health` must return `status: ready` and `database: postgres`.
5. Open `/api/demo` once to initialize the synthetic Fieldnote example. The direct seeded profile is `/startups/11111111-1111-4111-8111-111111111111`. The welcome page can create separate demo working copies.
6. Test the public deployment in a signed-out browser. Disable deployment protection for the submitted demo only if it prevents reviewers opening it. Verify startup creation, five saved sections, refresh/direct links, roadmap generation and status persistence.
7. Record the actual production and demo URLs in SUBMISSION.md. Do not present a preview behind authentication as the public submission.

GitHub/Vercel access is handled through the owner's existing account. New provider authorization, account agreements, or paid resources must be resolved explicitly; no credentials should be posted to issues or chat.

## Standalone container

```sh
docker compose up --build
```

This starts the web app at http://localhost:3000 and PostgreSQL 17 with a persistent named volume. The default `orbit-local-only` database password is a local development fixture; set `POSTGRES_PASSWORD` for a deployed environment. Do not expose the database port to the internet.

The Dockerfile builds Next.js standalone output and runs as a non-root user. Supply `DATABASE_URL`, `DEMO_MODE=true`, and any origin/proxy settings at runtime. Use HTTPS through the hosting platform or reverse proxy. The health check is `/api/health`.

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
