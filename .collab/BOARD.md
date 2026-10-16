# Orbit GTM Studio delivery board

The human owner's latest allocation supersedes earlier role proposals. GPT is the technical lead, backend developer and final integrator. Claude researches the official visual reference, designs AND IMPLEMENTS the frontend, and evaluates the implemented experience. An independent critique agent reports to GPT. The owner requests Opus 5.5 at full available effort for Claude Code; confirm the actual session model rather than merely naming it. English is the working language.

| Work | Owner | Status | Files |
| --- | --- | --- | --- |
| Requirements, architecture, shared API contract | GPT | Implemented and requirement-mapped | docs/, src/lib/domain/ |
| Official Black Orbit visual and motion research | Claude | Documented with official reference evidence | docs/design/ |
| Frontend design specification and interaction direction | Claude | Implemented; comparative revision reviewed | docs/design/ |
| Database, backend, roadmap rules, validation | GPT | Implemented; 23 tests pass with PostgreSQL CI | src/server/, src/app/api/, migrations/ |
| Premium frontend implementation | Claude | Six routes and composition revision integrated in PR #6; optional further author refinement can continue from main | src/app/ UI pages/layout/CSS, src/components/, public/ |
| Frontend/backend integration and final acceptance | GPT | Complete requirement map and functional gates pass | shared contract, integration fixes, tests |
| UX, responsive, accessibility, motion evaluation | Claude + independent critic | Rendered critic review and automated gates pass; aesthetic judgment retained in review notes | docs/design/INTEGRATION-REVIEW.md |
| Automated tests, acceptance, fixes | GPT | 23 backend + 67 HTTP/browser scenarios pass without retries; 24 hosted checks pass | tests/, e2e/ |
| CI, deployment, README, handover, submission | GPT | Vercel/Neon verified; final main release and committed-source package | .github/, docs/, README.md |

Use gpt/* and claude/* feature branches. Avoid switching branches in another agent's checkout; use an independent clone or worktree. Claude owns frontend UI files plus docs/design. GPT owns src/app/api, src/server, src/lib/domain, test/CI/deployment/package configuration, and final integration. GPT's preliminary frontend foundation can be replaced or improved by Claude. Changes to src/components/workspace.tsx and src/lib/client-api.ts must preserve the API contract. Announce shared domain or package requirements in LOG.md. Do not overwrite another contributor's work.
