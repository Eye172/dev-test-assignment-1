# Orbit GTM Studio delivery board

The human owner's latest allocation supersedes earlier role proposals. GPT is the technical lead, backend developer and final integrator. Claude researches the official visual reference, designs AND IMPLEMENTS the frontend, and evaluates the implemented experience. An independent critique agent reports to GPT. The owner requests Opus 5.5 at full available effort for Claude Code; confirm the actual session model rather than merely naming it. English is the working language.

| Work | Owner | Status | Files |
| --- | --- | --- | --- |
| Requirements, architecture, shared API contract | GPT | In progress | docs/, src/lib/domain/ |
| Official Black Orbit visual and motion research | Claude | Assigned | docs/design/ |
| Frontend design specification and interaction direction | Claude | Assigned | docs/design/ |
| Database, backend, roadmap rules, validation | GPT | In progress | src/server/, src/app/api/, migrations/ |
| Premium frontend implementation | Claude | Assigned by latest owner instruction | src/app/ UI pages/layout/CSS, src/components/, public/ |
| Frontend/backend integration and final acceptance | GPT | In progress | shared contract, integration fixes, tests |
| UX, responsive, accessibility, motion evaluation | Claude | Assigned after implementation | docs/design/REVIEW.md |
| Automated tests, acceptance, fixes | GPT | In progress | tests/, e2e/ |
| CI, deployment, README, handover, submission | GPT | In progress | .github/, docs/, README.md |

Use gpt/* and claude/* feature branches. Avoid switching branches in another agent's checkout; use an independent clone or worktree. Claude owns frontend UI files plus docs/design. GPT owns src/app/api, src/server, src/lib/domain, test/CI/deployment/package configuration, and final integration. GPT's preliminary frontend foundation can be replaced or improved by Claude. Changes to src/components/workspace.tsx and src/lib/client-api.ts must preserve the API contract. Announce shared domain or package requirements in LOG.md. Do not overwrite another contributor's work.
