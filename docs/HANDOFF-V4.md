# HANDOFF — Orbit GTM Studio v4 (for the next AI agent)

Written 2026-10-17 ~13:10 UTC+5 by Claude (Opus 5.5). Deadline for the test assignment: **2026-10-17 23:59 UTC+5**.

## 1. Situation

- Project: Orbit GTM Studio — developer test assignment (TZ: `D:\Ai_Startify_intership\Orbit_GTM_Studio_Developer_Test_Assignment.docx`). Next.js 16 + React 19 + TS + Zod + PostgreSQL/PGlite. Live prod (old v3): https://orbit-gtm-studio.vercel.app
- Repo: https://github.com/Eye172/dev-test-assignment-1. **Merging to `main` = Vercel production deploy → ask the owner first.**
- Owner (Russian-speaking) rejected the shipped v3 UI as shallow/"vibe-coded" and asked Claude to: research deeply (motion design, anti-AI-slop), write a do/don't doc, **build 3 frontend versions**, redo the landing (black hole: better angle/implementation), add **EN/RU/KK**, deepen the AI agents (more research, more diagrams/metrics, no "fill fields after analysis"), keep the TZ journey working. Colours/fonts only from blackorbit.site.
- Owner's reference projects for "depth": github.com/Eye172/campuslense-showcase, decentrathon5-project-v2, impact-hackathon-2.

## 2. Where the work is

- Backup of old main: branch `backup/pre-v4-2026-10-17`, tag `backup-2026-10-17-pre-v4` (commit 5046412) — pushed.
- Work branch: **`claude/studio-v4`** (pushed), worktree **`D:\Ai_Startify_intership\orbit-v4`**. Commits: 21a281c (v4 base), 226b0c0 (agents/i18n/tests) + later uncommitted/committed polish (check `git log`).
- Design contract & research: `docs/design/CRAFT-PLAYBOOK.md` (refuse list, motion tokens, 3 design reads, methodology, sources).
- Coordination log entry added in `.collab/LOG.md`.

## 3. What is DONE

**Infrastructure**
- `src/ui/prefs.ts`, `src/ui/server-prefs.ts`, `src/proxy.ts`: device cookies `orbit-locale`, `orbit-ui`, `orbit-theme`; `?ui=observatory|ledger|flow&lang=en|ru|kk&theme=` switches. Root layout renders `<html lang data-ui data-theme>`.
- i18n: `src/ui/i18n/en.ts` (+ en2..en5 batches merged), ru/ru2..5, kk/kk2..5; `dictionaries.ts`; client `src/ui/display.tsx` (`useDisplay().t/tk`), runtime `rt()` for non-hook code (`src/ui/i18n/runtime.ts`). Test enforces RU/KK cover every EN key with same placeholders.
- Fonts: Space Grotesk (no Cyrillic → falls back to Montserrat), Montserrat body, JetBrains Mono data.

**Three versions** (same routes): Observatory (dark instrument rail), Ledger (paper dossier, TOC scroll-spy, §chapters), Flow (stage bar, node graph with drawn edges, inspector). Shell in `src/components/workspace.tsx` (ObservatoryChrome/LedgerChrome/FlowChrome). Screens: `src/ui/screens/overview.tsx`, `dashboard.tsx`, `shared.tsx`, `ai-insights.tsx`, `onboarding-chrome.tsx`. Kit `src/ui/kit.tsx` (DisplayMenu = language/version/theme), models `src/ui/viz.tsx` (ReadinessRadar, AssumptionMap, ChannelBullseye, EvidenceLadder, PositioningStatement, SizingCalculator, LoadStrip). CSS: `src/app/styles/v4/{tokens,kit,viz,versions,landing,bridge}.css` (bridge = restyles reused old editors per version).

**Insight engine** `src/lib/domain/insights.ts` (deterministic, explainable): readiness radar (6 axes with reason codes), assumption map (Bland; stated + implied), channel bullseye (Traction 19 channels + KZ channels, ICE), evidence ladder, positioning (Dunford), price parsing, plan load, next action.

**Landing** `src/ui/landing/landing.tsx` + `black-hole.tsx` (raymarched Schwarzschild-approx lensing, photon ring, Doppler, tone-mapped, adaptive resolution; V1 cinematic ~9°, V3 high angle; V2 engraved SVG plate). Live models computed from demo data in `src/app/page.tsx`.

**Localized**: strategy editor, roadmap, onboarding flow/guided/launch/files, profile form, ui primitives, command palette, orbit dial, prepared panel, AI studio chrome. Roadmap rules generate tasks in EN/RU/KK (`generateRoadmap(startup, sections, locale)`, API body `{locale}`). Rule intake extraction understands RU/KK briefs (`extractCyrillic` in `src/lib/domain/intake.ts`).

**Agents (contract 3.0)**: `src/lib/domain/analysis.ts` adds `insights` (personas/JTBD, positioning, channel scores, market sizing, pricing research) with per-role gating `insightsFor(role)`; prompts in `src/server/ai/prompts.ts` (PROMPT_VERSION orbit-council-3.0.0): research coverage list, 6 searches/9 captures, no post-run questions (assumptions instead), output in `outputLanguage` (from run snapshot `founderLanguage`, set by `locale` on run create). Pre-run intake also localized (preflight 1.2.0). AI studio renders `AiInsightsPanel`.

**Quality**: `npx tsc --noEmit` clean, `npx eslint .` clean, `npx vitest run` 80/80 pass, `npm run build` passes. Dead v3 components removed. README updated for v4.

## 4. In progress / TODO (priority order)

1. **Live AI verification run** (paid, bounded $7): script `scratchpad/ai-run.mjs`, run against the **production server on port 3300** (started from bash: `PORT=3300 ... node --use-system-ca --env-file=.env.local .next/standalone/server.js`). The preview dev server (port 3200) has **no outbound network** → AI fails there with "Connection error". At 13:04 the run had intake+researcher completed, strategist running. Check that steps complete and `analysis.insights` is filled; if schema rejections occur, fix `insightsFor`/prompts.
2. **E2E (Playwright) suite is outdated** for v4 UI (`e2e/*.spec.ts`). Desktop run showed failures: dashboard "Customize"/plates tests (feature removed → delete those tests), "Workspace preferences" dialog (removed → use Display menu), selectors changed. Some English labels were re-aligned (Share and export, Export workspace as JSON, Studio access code, "Edit <title>", Roadmap progress). Log: `D:\Ai_Startify_intership\v4-e2e.log`. CI (`.github/workflows/verify.yml`) runs e2e on PR/main.
3. Visual polish per version (desktop + 375px): Ledger/Flow landing hero, mobile checks done for overview/dashboard; black-hole phone placement just moved below copy (verify).
4. Commit + push; then **ask owner** before merging `claude/studio-v4` → `main` (prod deploy) and before updating submission package (`D:\Ai_Startify_intership\submission-2026-10-17`).
5. Docs: handover/SUBMISSION refresh if owner wants v4 shipped.

## 5. Gotchas

- Bash heredocs with complex quotes sometimes break in this environment; I used `scratchpad/rep.py <file> <pairs.py>` (literal replacement pairs) for big edits.
- `\p{L}` in JS strings needs escaping; intake uses `%L` placeholder + `letters()`.
- Browser preview pane may be hidden → CSS animations frozen in screenshots (take a second screenshot).
- `.env.local` contains real secrets (OpenAI key, access code) — never print/commit.
- Owner preferences (memory): show directions/ask before big irreversible steps; GPT was formerly lead, but owner directly assigned this v4 work to Claude.

## 6. How to run

```
cd D:\Ai_Startify_intership\orbit-v4
npm ci   # already installed
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3200   # or preview config "orbit-v4"
npx vitest run ; npx tsc --noEmit ; npx eslint . ; npm run build
```
Demo profile: `/startups/11111111-1111-4111-8111-111111111111` (GET `/api/demo` seeds it).
