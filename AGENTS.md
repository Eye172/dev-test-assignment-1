<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project ownership and requirements

The human owner directs product scope. GPT is technical lead, backend implementer, final integrator and delivery owner. Claude Code owns premium frontend research, design and implementation. An independent critic reviews concrete UI evidence. Coordinate through GitHub issues, pull requests and .collab/LOG.md, using separate feature branches/checkouts.

Read docs/CONTRACT.md before changing interfaces. GPT owns src/server, src/app/api, src/lib/domain, tests, package/CI/deployment configuration. Claude owns UI pages/layouts, src/components, public and docs/design. Coordinate shared changes; do not overwrite another contributor's work. Preserve all assignment requirements and the owner's latest preferences. Keep research observations, design judgments and human instructions clearly distinguished.

Do not call strategy inputs or completed tasks commercially validated. Public data is synthetic and clearly labelled demo mode. Real persistence, accessible controls, full mobile behavior, reduced motion, draft safety and complete error/recovery paths are required. Finish with npm run verify and browser acceptance before marking a frontend milestone ready.
