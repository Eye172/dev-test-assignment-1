# Visual and language refinement — 17 October 2026

Owner direction: repair mixed languages, keep the black hole moving autonomously, try dense 5px ASCII without resizing the scene, alternate landing entrances, replace the thin chart treatment and clarify the orbit. The existing Black Orbit typography, green actions and three interface compositions remain authoritative.

## Materials and decisions

Applied the supplied `design_skills` Impeccable animate, colorize, harden and craft-floor guidance, plus Emil's animation decisions and scroll-reveal recipe. Landing is a persuasive surface; the workspace is an operating surface. Supporting movement uses the existing duration/easing tokens. The owner's explicit alternating slide request takes precedence over the older playbook's prohibition on repeated section reveals.

The supplied `git_web_animation_pack1.md` links [webgl-ascii-hero](https://github.com/egorshest/webgl-ascii-hero) and [Particle-logo-simulation](https://github.com/Animmaster/Particle-logo-simulation). These informed the luminance-to-glyph and particle-assembly techniques. The implementation is project-native code; no third-party GLB, model, copied asset or extra rendering dependency is bundled. The black hole remains a ray-integrated three-dimensional scene, rather than a rotating imported mesh. ASCII is a separate rendering mode over that same scene.

## Resulting behavior

- **Hero:** time drives the disk, fine particles and subtle camera drift without pointer input. Light/ASCII controls share identical scene bounds. ASCII samples one ray per **5 × 5 CSS pixel** cell and shades it through a small glyph atlas; display density does not change with adaptive light-mode resolution. A pause control, live reduced-motion response, offscreen/hidden-tab suspension and a WebGL fallback remain. Desktop and Chromium phone tests exercise both modes and pause.
- **Landing:** sections arrive once from alternating directions, using transforms and opacity without changing document flow. Server-rendered content stays visible without JavaScript. A bounded 420-particle assembly connects the five decisions. The generic specialist roster was removed.
- **Readiness:** filled contour bands, a stronger data shape and numbered dimensions replace floating labels. Normal-flow score controls expose the actual rule explanations and remain usable on narrow screens. Zero scores are plotted at zero. Scores are always computed from original saved data; changing language cannot change the numbers.
- **Assumptions:** four rounded tonal regions, large category shapes and numbered keys replace a thin coordinate grid. Warm markers identify the test-first quadrant. Collision placement stays inside each point's semantic quadrant; positions are qualitative, not exact measured evidence coordinates. The shorter graphic labels fit all three languages; full meanings stay in lists and explanations.
- **Channels:** filled rings separate selected channels, next candidates and the outer possibility set. Blue numbered candidates and green active channels have a matching legend. On phones, ICE inputs move below the channel name so the name retains reading width; all scores remain available.
- **Orbit:** five section colours are named in the legend; the blue outer arc encodes the actual plan completion percentage and the gold marker identifies the plan day. The former approximation that lit day ticks from weekly task fractions was removed. Empty sections, drafts, completion, plan progress and elapsed day have distinct meanings. Colour is accompanied by text and ratios.
- **Workspace motion:** brief opacity transitions support diagram arrival; routine reading surfaces do not drift or bounce. OS and saved reduced-motion settings apply. The Flow landing loop also reacts to live preference changes and visibility.

## Language and data boundaries

The synthetic Fieldnote profile, section examples and generated tasks now display in EN/RU/KK, including copies created before this update. Seed translation matches the original value at the same field path. Edited founder fields, task notes, custom work and AI proposals retain their text. System task translation requires an unchanged title, deliverable and rationale plus the generated/unedited provenance; merely sharing a rule key is insufficient. Locale changes perform no database write. A clean example editor follows the language projection at the same revision; a dirty draft remains intact.

Market, readiness, completion and pricing calculations continue to use raw saved inputs. Translation changes presentation only. No completion state or generated task is called market validation.

## Verification record

`npm run verify`: lint, strict types, 88 domain/SQL tests and production build. Browser results and final captures are recorded in [V4-COMPLETION.md](../V4-COMPLETION.md) and `docs/verification/v4/`.

The independent read-only critic found an untranslated derived category, a narrow pause target and a Flow reduced-motion timer issue; all three were corrected in the implementation batch. The manual design detector also flagged existing neutral Ledger selection marks, a CSS triangle arrow and the ICE bar endpoint as card stripes. They encode navigation/geometry/data rather than decorative card borders. Its stroke-width-transition warning was addressed by retaining only a stroke-colour transition. These warnings are not reported as a clean detector run.

Rendered review is bounded to a desktop/phone inspection and one confirmation after the repair batch. Automated checks complement these screenshots; they do not certify physical-device GPU performance.
