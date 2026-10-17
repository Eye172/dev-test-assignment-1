# Visual and language refinement — 17 October 2026

Latest owner direction: remove yellow chart accents, ASCII and repeated notices; improve the light black hole’s smoothness and brightness; make the landing hypothesis example legible and replace abstract readiness language with concrete GTM-plan labels. The existing Black Orbit typography, green actions and three interface compositions remain authoritative.

## Materials and decisions

Applied the supplied `design_skills` Impeccable animate, colorize, harden and craft-floor guidance, plus Emil's animation decisions and scroll-reveal recipe. Landing is a persuasive surface; the workspace is an operating surface. Supporting movement uses the existing duration/easing tokens. The owner's explicit alternating slide request takes precedence over the older playbook's prohibition on repeated section reveals.

The supplied `git_web_animation_pack1.md` links [webgl-ascii-hero](https://github.com/egorshest/webgl-ascii-hero) and [Particle-logo-simulation](https://github.com/Animmaster/Particle-logo-simulation). These informed the luminance-to-glyph and particle-assembly techniques. The implementation is project-native code; no third-party GLB, model, copied asset or extra rendering dependency is bundled. The black hole remains a ray-integrated three-dimensional scene, rather than a rotating imported mesh. The owner subsequently removed ASCII; only the light rendering remains. The independent particle-assembly scene is retained.

## Resulting behavior

- **Hero (latest owner revision):** only the light WebGL scene remains. The disk is slightly brighter; a full-resolution linear texture and edge-aware antialiasing pass smooth the lens silhouette and photon ring. Resolution stays at or above one rendered pixel per CSS pixel (up to 1.5× DPR), replacing the old 0.34–0.8 quality scale. GPU work is capped at 30 frames/second rather than degrading spatial quality. The small pause control, autonomous disk/particles/camera, live reduced-motion response, offscreen suspension and visible WebGL fallback remain. ASCII code and mode controls were removed.
- **Landing:** sections arrive once from alternating directions, using transforms and opacity without changing document flow. Server-rendered content stays visible without JavaScript. A bounded 420-particle assembly connects the five decisions. The generic specialist roster was removed.
- **Readiness:** filled contour bands, a stronger data shape and numbered dimensions replace floating labels. Normal-flow score controls use concrete GTM labels (customer segment, value proposition, channels, monetization, hypotheses/tests and action plan). Rule explanations appear only after selecting a score; the repeated abstract disclaimer was removed. Controls remain usable on narrow screens. Zero scores are plotted at zero. Scores are always computed from original saved data; changing language cannot change the numbers.
- **Assumptions:** four rounded tonal regions, large category shapes and numbered keys replace a thin coordinate grid. Green markers identify the test-first quadrant; its quiet green surface replaces the yellow slab. The landing-only illustrative scenario distributes six hypotheses across all four regions. Its sample positions never change workspace evidence or task states. Collision placement stays inside each point's semantic quadrant; positions are qualitative, not exact measured evidence coordinates. The shorter graphic labels fit all three languages; full meanings stay in lists and explanations.
- **Channels:** filled rings separate selected channels, next candidates and the outer possibility set. Blue numbered candidates and green active channels have a matching legend. On phones, ICE inputs move below the channel name so the name retains reading width; all scores remain available.
- **Orbit:** five section colours are named in the legend; the blue outer arc encodes the actual plan completion percentage and the mint marker identifies the plan day. The former approximation that lit day ticks from weekly task fractions was removed. Empty sections, drafts, completion, plan progress and elapsed day have distinct meanings. Colour is accompanied by text and ratios.
- **Workspace motion:** brief opacity transitions support diagram arrival; routine reading surfaces do not drift or bounce. OS and saved reduced-motion settings apply. The Flow landing loop also reacts to live preference changes and visibility.

## Language and data boundaries

The synthetic Fieldnote profile, section examples and generated tasks now display in EN/RU/KK, including copies created before this update. Seed translation matches the original value at the same field path. Edited founder fields, task notes, custom work and AI proposals retain their text. System task translation requires an unchanged title, deliverable and rationale plus the generated/unedited provenance; merely sharing a rule key is insufficient. Locale changes perform no database write. A clean example editor follows the language projection at the same revision; a dirty draft remains intact.

Market, readiness, completion and pricing calculations continue to use raw saved inputs. Translation changes presentation only. No completion state or generated task is called market validation.

## Verification record

`npm run verify`: lint, strict types, 89 domain/SQL tests and production build. Browser results and final captures are recorded in [V4-COMPLETION.md](../V4-COMPLETION.md) and `docs/verification/v4/`.

The independent read-only critic found an untranslated derived category, a narrow pause target and a Flow reduced-motion timer issue; all three were corrected in the implementation batch. The manual design detector also flagged existing neutral Ledger selection marks, a CSS triangle arrow and the ICE bar endpoint as card stripes. They encode navigation/geometry/data rather than decorative card borders. Its stroke-width-transition warning was addressed by retaining only a stroke-colour transition. These warnings are not reported as a clean detector run.

Rendered review is bounded to a desktop/phone inspection and one confirmation after the repair batch. Automated checks complement these screenshots; they do not certify physical-device GPU performance.

The first PostgreSQL CI run passed 95 browser cases; its full-size desktop live-WebGL smoke timed out during software-GPU startup. Its trace reported GPU stalls from ReadPixels. That smoke now uses a bounded 960×740 desktop viewport and a 30-second readiness/frame budget; continuous video/trace screenshots are disabled for this small design test file, retaining DOM/source failure traces and the regular suite's visual recordings. Scene dimensions are measured in layout pixels independently of scroll/parallax position. The latest tests check native drawing resolution, autonomous light frames, pause/reduced motion and the four-region landing example. The retired ASCII assertions were removed. Full-size responsive/accessibility coverage and the earlier successful local 1440px live-render run are retained.

## Latest copy and assignment reconciliation

The owner rejected yellow chart accents, ASCII, repeated demo badges and abstract language such as “customer clarity” or “risk awareness”. Those preferences supersede the earlier visual proposal. Removed the header badge, onboarding notice, hero note and repeated overview/dashboard/orbit disclaimers. One brief demo disclosure remains in the landing footer: original assignment §06 explicitly requires it when authentication is omitted. The create/demo actions, private AI gate and all original persistence/completeness rules are unchanged. See [original assignment cross-check](../ASSIGNMENT-CHECK.md).

Before this revision the 1440×1000 hero rendered a 893×620 scene even in reduced motion. The latest renderer keeps the 1440×1000 scene at that viewport and filters edges without changing its displayed size. Browser emulation is not a physical-device GPU certification.

Latest owner follow-up also removes the entire “What this is / What this is not” landing section and its navigation anchor.
