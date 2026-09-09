# Previs prototype design QA

September 9 follow-up: the director requested quick design iteration and no tests.
The latest pass restores timeline lanes above playable cue rows, uses the actual
ShotDescriptionViewer in both sizes, and keeps equal monitor panes with a missing-
generation placeholder. A single windowed Chrome screenshot was inspected; no
tests or fullscreen checks were run. The report below records the earlier pass
and is not an acceptance gate for ongoing prototype feedback.

**Final result: blocked** — fullscreen verification remains incomplete after the
Codex in-app browser entered fullscreen and froze. The windowed prototype is
available for design feedback; this is not a claim of complete acceptance.

## Visual evidence

- Source: `references/combined-monitor.png` (1488 × 1056).
- Rendered target: http://127.0.0.1:4177/, dark theme, Revision 3 paused at 8s.
- Desktop viewport: 1440 × 1024, screenshot density 1×.
- Source was scaled and letterboxed to 1440 × 1024 before comparison.
- Full comparison: `screenshots/comparison-paired.png` (reference left, UI right).
- Focused cue/Description comparison: `screenshots/comparison-cues.png`.
- Final paired state: `screenshots/paired.png`.
- Single revision state: `screenshots/single.png`.
- Expanded Description: `screenshots/description-dialog.png`.
- `screenshots/fullscreen-previs.png` records the unsuccessful fullscreen check;
  it is not passing evidence.

## Findings and iterations

1. **P2, fixed: playback track treatment.** The initial default slider was too
   thick and its hollow thumb drifted from the mock. Changed to a 4px track and
   solid 14px amber thumb. The later combined comparison shows the clean shared
   timeline with no duplicate per-video scrubbers.
2. **P2, fixed: dense-text typography.** Initial cue text and timecodes were too
   small and the mono font variable was unresolved. Set Montserrat/Geist Mono at
   the root, cue text 13px, timecodes 12px and Description 14px. The focused later
   comparison shows legible cue columns and Description wrapping.
3. **P2, fixed: single-view proportions.** The first single layout left the video
   too small in its matte. Increased its viewport-based height and compacted the
   lower panels. `single.png` shows all three cue rows and Description with a
   larger visualization and no reserved generation card.
4. **P1, unresolved verification: fullscreen host failure.** Fullscreen inside
   Codex affected the entire host application and required force quit. Stop this
   test path; see `fullscreen-investigation.md`. No root-cause fix is claimed.

## Fidelity surfaces

- **Fonts/typography:** Studio Montserrat, restrained uppercase section labels,
  Geist Mono timecodes. Hierarchy and readable weights retained; actual authored
  content controls wrapping rather than reproducing image-model text errors.
- **Spacing/layout:** equal 16:9 paired screens, compact revision bar, one
  transport, horizontal legend, approximately 61/39 lower grid, softly rounded
  surfaces. Single mode allocates the whole monitor and preserves video aspect.
- **Colors/tokens:** existing Studio dark theme plus the approved amber accents,
  subdued borders, inset Description surface and subject dots. Active cues use
  an amber border as in the source. Names accompany colors.
- **Image quality:** real local previs and generation files; no fabricated CSS
  scenery or stretched frames. Movie frames differ from ImageGen's extrapolated
  frames intentionally. This is the actual media being evaluated.
- **Copy/content:** short labels, title and Beats retained. No Compare button,
  placeholder generation panel, explanatory marketing copy or invented extra
  Beat badges. Description and cue prose are explicitly fixture content.

No remaining actionable windowed P0/P1/P2 visual mismatch was identified in the
post-fix combined and focused comparisons. Fullscreen remains outside that result.

## Interaction and code verification

- [x] Prev/Next changes revisions and cues; first/last boundaries disable.
- [x] Missing generation produces one monitor; Revision 3 produces an equal pair.
- [x] Shared play and cue seeking move both videos; normal view has one slider.
- [x] Keyboard scrubbing verified in Chrome: both videos advanced from 8 to 8.01s.
- [x] Shorter generation ends at 15.104s, previs at 17s, both at playback rate 1.
- [x] Existing MediaCard opens the plan; breadcrumb returns to its card.
- [x] Compact Description scroll verified in Chrome (scrollTop 336.5px); expanded
  dialog opens and closes using Studio's existing Dialog.
- [x] Existing VideoPlayer tests pass: 2 tests in 1 file.
- [x] Shared-player focused ESLint passes; prototype Vite build passes.
- [x] `git diff --check` passes; existing source change is confined to VideoPlayer.
- [ ] Complete fullscreen verification outside the Codex embedded browser.
- [ ] Obtain director feedback before finalizing the production implementation plan.

No mobile checks, provider requests, project-data writes or full application
integration were performed. The draft prototype scaffolding is retained for
future work, but nothing was deployed.
