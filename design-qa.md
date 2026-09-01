# Shot Plan Audio Design QA

Final result: passed

## Evidence

- Source visual truth:
  `/Users/keremk/.codex/generated_images/01a058d7-7467-7611-bcf2-5031bbd44374/exec-610c729f-e4be-488f-9e8c-2744f65e1642.png`
- Browser-rendered implementation:
  `tmp/design-qa/shot-plan-audio/shot-plan-audio-selected-revised.png`
- Narrative turn-number evidence:
  `tmp/design-qa/shot-plan-audio/narrative-turn-numbers.png`
- Full-view combined comparison:
  `tmp/design-qa/shot-plan-audio/shot-plan-audio-comparison-revised.png`
- Focused card comparison:
  `tmp/design-qa/shot-plan-audio/card-comparison.png`
- Narrator placeholder source reference (the Cast-page state shown in the user's appshot):
  `tmp/design-qa/shot-plan-audio/cast-narrator-placeholder-reference.png`
- Narrator placeholder implementation:
  `tmp/design-qa/shot-plan-audio/narrator-placeholder-fixed.png`
- Narrator placeholder focused comparison:
  `tmp/design-qa/shot-plan-audio/narrator-placeholder-comparison.png`
- Thin-line waveform implementation:
  `tmp/design-qa/shot-plan-audio/waveform-thin-lines.png`
- Thin-line waveform playing state:
  `tmp/design-qa/shot-plan-audio/waveform-thin-lines-playing.png`
- Thin-line waveform full-view comparison:
  `tmp/design-qa/shot-plan-audio/waveform-full-comparison.png`
- Thin-line waveform focused comparison:
  `tmp/design-qa/shot-plan-audio/waveform-focused-comparison.png`
- Viewport: 1487 × 1058 CSS pixels.
- Source pixels: 1487 × 1058. Implementation pixels: 1487 × 1058.
- Density normalization: direct 1:1 comparison at the same pixel dimensions; no density conversion.
- State: dark desktop Studio, Shot Plan Audio tab, one selected single-Turn card. The real Urban Basilica data differs from the mock's illustrative speakers/ranges, but the card anatomy and interaction state are equivalent.
- Narrator regression viewport: 1280 × 720 CSS pixels. The 313 × 313 Cast placeholder and 130 × 130 Audio portrait were normalized to 260 × 260 for focused comparison because the two product surfaces intentionally use different card sizes.
- Waveform regression viewport: 1280 × 720 CSS pixels. The original 1488 × 1058 mock was normalized to a 720-pixel height for full-view comparison. Focused source and implementation waveform crops were normalized to 620 × 85 pixels; the surrounding product states differ because the card design evolved after the original mock, so the focused waveform treatment is the fidelity target.

## Required Fidelity Surfaces

- Fonts and typography: the implementation preserves Studio's existing typeface, uppercase Turn label, compact tracking, metadata hierarchy, and tab treatment. No actionable wrapping or hierarchy difference remains.
- Spacing and layout rhythm: the fixed portrait column, divider, waveform area, metadata baseline, card radius, vertical stack, and bottom-right selection action match the approved direction. The implementation retains the real Scene tab shell above the Shot Plan tabs; the mock omitted that existing product shell, so this is an expected context difference rather than card drift.
- Colors and visual tokens: the first comparison showed the Audio card surface materially lighter than the mock. The card now uses the darker Studio background token while retaining the primary selected border and standard Media Card action colors.
- Waveform rendering: the implementation uses 144 stable one-pixel lines across the available span. Their heights are deterministically varied per audio file, preserving the mock's thin-line rhythm without presenting the synthetic shape as real analyzed audio. A clipped primary-color overlay supplies playback progress without changing line geometry.
- Image quality and asset fidelity: cards use the current selected Cast Profile images at an uncropped portrait-friendly scale. A voice-over Cast Member without a selected profile image now uses the same shared waveform placeholder as the Cast overview, scaled proportionally for the smaller Audio portrait; the generic person icon is no longer shown for Narrator.
- Copy and content: cards show only Turn/range, playback time, provider/model provenance, and generated date. They contain no dialogue text, speaker names, Whole Shot Plan label, right action column, duplicate duration, link action, heading/subtitle, or New Take action.

## Interaction And Runtime Checks

- Selected Turn 3 through the shared Media Card selection control and confirmed `aria-pressed=true` plus the selected border/control state.
- Reloaded and inspected the Audio route after database migration.
- Returned Turn 3 to its original unselected state after capture.
- Confirmed Narrative presents canonical Turn numbers 1 through 5 and no dialogue-audio side panel controls.
- Confirmed the real Urban Basilica Turn 1 response identifies Narrator as a voice-over Cast Member, the Audio card renders one `voice-over-profile-placeholder`, and no `Narrator has no selected profile image` generic state remains.
- Confirmed the Cast overview still renders the same Narrator waveform placeholder after sharing the component.
- Confirmed each 607.94-pixel Audio waveform contains 144 one-pixel lines with 37 distinct rendered heights in the inspected Take.
- Played Turn 2 and confirmed the progress overlay advanced from fully clipped to 34.76% visible while the base waveform remained unchanged.
- Confirmed the browser console reported no errors.
- Automated desktop smoke tests passed separately.

## Comparison History

### Iteration 1 — blocked

- [P2] Audio card surface was substantially lighter than the approved mock, weakening the intended contrast between cards and the Shot Plan canvas.
- Fix: changed the Audio card body from the semi-transparent Card token to the darker Studio background token while preserving shared border, selection, and action behavior.

### Iteration 2 — passed

- The revised full-view comparison shows the intended dark card surface, primary selected outline, quiet metadata, portrait column, and waveform hierarchy.
- No actionable P0, P1, or P2 fidelity differences remain.

### Iteration 3 — Narrator placeholder regression, passed

- [P1] Narrator's Audio portrait used the generic missing-profile person icon even though the Cast overview intentionally represents voice-over Cast Members with a waveform placeholder.
- Fix: projected the provider-neutral `isVoiceOver` Cast fact with each dialogue speaker and reused one shared responsive waveform placeholder in both the Cast overview and Audio card.
- Post-fix evidence: the normalized focused comparison shows the same background, center line, glow, capsule, and waveform treatment on both surfaces. The Audio route renders the placeholder exactly once, the generic Narrator missing-image state is absent, and both checked pages report no console errors.
- No actionable P0, P1, or P2 fidelity differences remain.

### Iteration 4 — stretched waveform regression, passed

- [P2] Stretching 48 flexing bars across the card turned individual waveform lines into wide capsules at desktop widths, drifting from the original mock's fine waveform texture.
- Fix: restored one-pixel fixed-width lines, increased the count to 144, distributed them across the full width, and generated a stable pseudo-random height pattern from each audio URL. The existing progress overlay continues to highlight the elapsed portion during playback.
- Post-fix evidence: the focused comparison shows the same thin-line vocabulary as the mock, with denser coverage appropriate to the implementation's wider waveform region. Browser measurement confirms every line remains exactly one pixel wide; playback and console checks pass.
- No actionable P0, P1, or P2 fidelity differences remain.

## Residual Test Gaps

- The populated project contains only single-speaker migrated Takes, so the 2×2 and `+N speakers` portrait variants are verified by component tests rather than this real-project screenshot.
- Fal.ai Seed Audio generation was not executed because the approved scope does not authorize a paid provider run.
