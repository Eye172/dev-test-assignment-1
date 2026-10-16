# Architecture decisions

## 2026-10-16 — Ownership and preferred stack

GPT leads and implements; Claude researches/designs/evaluates the frontend. Next.js App Router, React, strict TypeScript. Server-side PostgreSQL persistence using parameterized SQL. A persistent PGlite development adapter executes the same PostgreSQL schema when no cloud database is configured; production requires DATABASE_URL. No browser-only persistence substitution.

## 2026-10-16 — Flexible drafts and honest progress

Save incomplete strategy sections independently. Required inputs determine completeness on the server: completed sections / 5 * 100. Section completeness and task completion never imply commercial validation. Channels accept custom names up to three. Optional notes/context/custom fields complement required fields.

## 2026-10-16 — Roadmap reconciliation

Generate 8–10 current tasks using explicit rules, with title, week, status and deliverable. Stable rule keys reconcile regeneration; completed task content and statuses survive. Superseded tasks stay in history. User-created tasks are never overwritten. Each task exposes why it was suggested. Changes use optimistic concurrency revisions.
