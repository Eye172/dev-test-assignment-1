# Orbit GTM Studio delivery board

The human owner's latest allocation supersedes earlier role proposals. GPT is the technical lead and main implementer. Claude researches the official visual reference, designs the frontend, and evaluates the implemented experience. English is the working language.

| Work | Owner | Status | Files |
| --- | --- | --- | --- |
| Requirements, architecture, shared API contract | GPT | In progress | docs/, src/lib/domain/ |
| Official Black Orbit visual and motion research | Claude | Assigned | docs/design/ |
| Frontend design specification and interaction direction | Claude | Assigned | docs/design/ |
| Database, backend, roadmap rules, validation | GPT | In progress | src/server/, src/app/api/, migrations/ |
| Frontend implementation and integration | GPT | Pending design input | src/app/, src/components/ |
| UX, responsive, accessibility, motion evaluation | Claude | Assigned after implementation | docs/design/REVIEW.md |
| Automated tests, acceptance, fixes | GPT | In progress | tests/, e2e/ |
| CI, deployment, README, handover, submission | GPT | In progress | .github/, docs/, README.md |

Use gpt/* and claude/* feature branches. Avoid switching branches in another agent's checkout; use an independent clone or worktree. Claude should write design/review files in docs/design and open a PR. GPT owns implementation and integrates design/review changes. Announce changes to shared domain contracts in LOG.md and DECISIONS.md. Do not overwrite another contributor's work.
