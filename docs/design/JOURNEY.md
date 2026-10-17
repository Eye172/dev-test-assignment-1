# Founder journey and craft principles (v3)

Owner: Claude · 2026-10-17 · supersedes the onboarding parts of REMAKE.md. Owner decisions are marked **(owner)**; everything else is design judgment.

## 1. Journey

| # | Step | What the founder does | What the system does |
|---|---|---|---|
| 0 | Landing | Sees the product move: a large live orbit scene behind the hero. One action: *Start*. Demo is secondary. | Static first paint; the 3D scene fades in only when the GPU is ready and pauses off-screen. |
| 1 | Choose a path **(owner)** | **Free form** or **Guided**. Either path can attach existing material (pitch, deck, notes) **(owner)**. | Explains each path in one line and how long it takes. |
| 2a | Free form | Writes everything in their own words, attaches files. | Extracts the profile and strategy hints. Then a short chat asks only for what is still missing: **max 7 questions, no chat when nothing is missing, stops as soon as the required set is complete (owner)**. |
| 2b | Guided | Answers a deep, practical form: every closed question has a complete option set, open questions are narrow and concrete **(owner)**. | Business model stays B2B/B2C/B2G (assignment schema) with a second level: SaaS, marketplace, D2C, B2B2C, services, hardware, platform/API, other. |
| 3 | Confirm profile | Sees the six required fields filled, with their origin (*your text*, *file*, *answer*, *chosen*). Edits inline. Validation is the assignment's. | Creates the startup (`POST /api/startups`). |
| 4 | Orbit transition **(owner)** | Nothing to do; can leave at any moment — it never blocks work **(owner)**. | Shows real progress only: each segment lights when its real step finishes (profile saved, AI roles from GPT's run journal, roadmap generated). No fake percentages. Collapses into the navigation dial. |
| 5 | What AI made **(owner)** | Lands on a review of the AI proposals: compare with what is saved, apply section by section, or edit. | GPT's `apply` with version checks. Without AI access: the rule-based drafts and the generated roadmap, clearly labelled. |
| 6 | Work | Strategy, dashboard, roadmap, evidence. | Unchanged contract. |

Honesty rules: rule-based output is never labelled AI; AI drafts are "Draft · untested" until the founder applies or saves them; completion stays the assignment's formula.

## 2. Craft principles (from research, see sources at the end)

1. **Restraint is the premium signal.** Pure, low-saturation colour; one accent used as punctuation, "a highlighter you only get to use once" per viewport; generous whitespace as an active element (*ma*), not leftover space. No glassmorphism-by-default, no gradient-by-default, no identical three-card rows.
2. **Type carries hierarchy.** Few sizes, skipped steps not interpolated; display 1.0 line-height, body 1.5–1.55, body never under 14px; tabular numerals for figures.
3. **Motion has a job.** One message per movement (Toss): state change, enter/exit, loading → completion. Nothing on keyboard-driven or 100×/day actions.
4. **Fast and interruptible.** UI motion ≤ 300 ms, ease-out for entering; springs for anything the hand moves (they keep velocity when interrupted). CSS transitions over keyframes where interruption matters.
5. **Only transform and opacity.** Never animate layout properties; no `layout` scale on text-bearing boxes (distortion). Heavy pages: prefer CSS/WAAPI over rAF-driven libraries.
6. **One thing per screen** (Toss) for the onboarding steps; the review screen is the exception, by design.
7. **3D is for high-impact moments only** (Toss), with a static fallback, capped DPR, paused off-screen/hidden, legible scrim behind text, busiest motion at the edges.
8. **Reduced motion is a design, not a switch-off:** swap movement for fades; keep state changes visible.
9. **Review tomorrow:** every animation is checked at 0.25× speed and on a mid-range phone before it ships.

## 3. Contract needed from GPT (pre-creation intake)

The existing AI endpoint requires a startup id. Onboarding needs extraction *before* creation:

```
POST /api/intake            (owner-gated like /ai; same signed cookie)
  {action:"start", payload:{text, files:[{name, mediaType, dataBase64}]}}   ≤3 files, ≤5 MB each: pdf, txt, md, docx
  {action:"answer", payload:{intakeId, questionId, answer}}
→ {data:{
    intakeId,
    profile: Partial<StartupInput>, strategy: Partial<SectionDataMap>,
    origin: Record<string,"text"|"file"|"answer">,
    missing: string[],                 // required profile fields still empty
    question: {id, field, text, kind:"choice"|"text", options?: string[]} | null,
    asked: number, limit: 7
  }}
POST /api/ai/unlock          // global unlock before a startup exists
POST /api/startups/:id/ai {action:"create", payload:{mode:"full", brief, requestId, intakeId?}}   // intakeId attaches text, files and answers to the brief
```

Server enforces the 7-question cap and stops asking when `missing` is empty. Until this exists, the frontend runs the same flow with deterministic extraction and labels it "rules".

## Sources

[Emil Kowalski: Great animations](https://emilkowal.ski/ui/great-animations) · [Toss: motion in finance](https://toss.im/tossfeed/article/why-motion-in-finance) · [Simplicity / One thing per screen](https://designcompass.org/2025/04/28/toss-simplicity/) · [Utsubo: Japanese web design](https://www.utsubo.com/ja/blog/japanese-web-design-style-guide) · [web.dev easing (ja)](https://web.dev/articles/the-basics-of-easing?hl=ja) · [Spacing deck](https://speakerdeck.com/yuyaink/spacing) · [Digitaling: 高级感](https://www.digitaling.com/articles/671873.html) · [Woshipm: 动效](https://www.woshipm.com/ucd/286148.html) · [maily: 마이크로인터랙션 6원칙](https://maily.so/uiux/posts/knrj56jwzld) · [Why AI sites look the same](https://dev.to/lyd_lyd_d4869af25d33ce0eb/why-do-ai-generated-websites-all-look-the-same-k2j) · [Managed Code](https://managed-code.com/blog-post/why-ai-websites-look-the-same) · [Stripe/Linear/Vercel tokens](https://opendesigner.io/blog/recreating-stripe-linear-vercel-design-systems-with-design-md) · [WebGL hero practice](https://21st.dev/blog/react-shader-background-components) · [R3F performance](https://tessl.io/registry/skills/github/zebbern/claude-code-guide/r3f-best-practices) · [Rauno Freiberg](https://yespress.io/rauno-freiberg.md) · [Your UI needs more Walt Disney](https://www.uxtools.co/blog/your-ui-needs-more-walt-disney) · [LEANSpark canvas paths](https://leanspark.ai/guides/tutorial-create-canvas) · [Mad Libs forms](https://mac.konigi.com/blog/mad-libs-style-form-increases-conversion-25-40) · [Appcues onboarding](https://www.appcues.com/blog/the-10-best-user-onboarding-experiences?so=1) · [Typeform completion](https://help.typeform.com/hc/en-us/articles/360029615911)
