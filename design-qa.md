# Shot Plans Studio UI — Design QA

Date: 2026-07-27

Reference:

- `plans/active/assets/0157-shot-plans-studio-ui/index.html`
- checked-in 1440×900, 1024×900, and dialog-state screenshots beside the artifact

Production verification:

- Compared collection, detail, compact detail, Description, still preview,
  motion preview, Camera glossary, and Motion glossary in same-state,
  same-viewport side-by-side images.
- Verified the collection uses the accepted three-column desktop grid,
  selected-image mosaics, quiet empty state, Beat labels, and `+N` overflow.
- Verified detail navigation, independent Shot rail/detail scrolling, amber
  image-only selection, quiet empty Shot, and fixed-width Brief cards that wrap
  instead of shrinking or stretching.
- Verified exact long Markdown wraps and scrolls in the read-only Description
  surface.
- Verified media previews and the 9/8/10 Framing, Camera, and Motion glossaries,
  including current/start/end markers and Rack Focus still media.
- Verified keyboard focus return for plan Back, candidate dialog, media
  previews, and glossary dialogs.
- Verified plan delete/Trash restore and candidate select/delete/Trash restore
  against an isolated clone of `urban-basilica`.
- Rechecked Shot detail at 1024×900 after the fixed-card correction. Every
  Brief card measures 204 pixels, wraps without shrinking or stretching, and
  the Covered Beats group sits below the exact Shot title.
- Rechecked the Shot rail sizing contract: it starts from the named percentage
  constant and respects the named 210-pixel hard minimum at compact desktop
  widths.

Resolved deviations:

- Made the collection root fill the Scene panel so the grid does not
  shrink-wrap to one column.
- Rendered Core’s zero-based Beat positions as one-based product labels.
- Added specific accessible names for Back and glossary actions.
- Enabled CodeMirror line wrapping for long authored Shot descriptions.

final result: passed

## Reusable MediaCard Preview And Collection Dialogs

Date: 2026-07-28

Source capture:

- Captured from detached pre-refactor commit `97583739` with the same
  deterministic E2E project, Chromium compatibility project, theme, and
  viewport used for implementation verification.
- The locked source images live in
  `packages/studio/e2e/tests/compatibility/media-card-interactions.compat.spec.ts-snapshots/`.
  The unchanged-state assertions compare production directly with these
  pre-refactor files; they were not regenerated to accept refactor drift.
- Dynamic-media masks: none. The fixture uses deterministic local images, so
  card imagery, selected-state controls, and viewer controls remain visible in
  every comparison.

Implementation capture:

- `shot-rail-wide`: 1440×900 CSS pixels, DPR 1.
- `shot-rail-compact`: 1024×900 CSS pixels, DPR 1.
- multi-image Shot collection, Reference Picker, and gallery viewer:
  1024×900 CSS pixels, DPR 1.
- Shot loading and error collections: 1280×720 CSS pixels, DPR 1.
- one-image direct viewer and multi-image nested viewer: 1440×900 CSS pixels,
  DPR 1.

Same-input comparison evidence:

- `plans/active/assets/0160-media-card-dialogs/design-qa/rail-full-source-vs-implementation.png`
- `plans/active/assets/0160-media-card-dialogs/design-qa/candidate-full-source-vs-implementation.png`
- `plans/active/assets/0160-media-card-dialogs/design-qa/candidate-focused-source-vs-implementation.png`
- `plans/active/assets/0160-media-card-dialogs/design-qa/reference-full-source-vs-implementation.png`
- `plans/active/assets/0160-media-card-dialogs/design-qa/reference-focused-source-vs-implementation.png`
- `plans/active/assets/0160-media-card-dialogs/design-qa/gallery-viewer-source-vs-implementation.png`
- `plans/active/assets/0160-media-card-dialogs/design-qa/viewer-source-and-new-paths.png`

Accepted Shot interaction constraints:

- The rail card still selects the Shot; it does not open a viewer.
- When images exist, the lower-right rail action opens the image flow for that
  exact Shot.
- Zero images leave the placeholder rail card without a lower-right image
  action or Dialog.
- One ready image opens the existing shared viewer directly and exposes no
  choose control or implicit selection.
- Multiple ready images open the unchanged flush collection. Whole-card
  activation previews, while the existing lower-right choose control remains
  the only selection mutation.
- Direct and nested viewer close both return focus to the exact trigger.

Comparison findings:

- Wide and compact rail geometry, typography, spacing, colors, borders, image
  treatment, selected state, and action placement match the source pixels.
- Flush Shot collection and inset Reference Picker anatomy match the source
  pixels in both full-view and focused comparisons.
- Loading, error, ready, and Retry states match the source pixels.
- Gallery preview activation moved to the semantic shared contract without a
  visible viewer change.
- The new direct and nested Shot paths use the accepted shared viewer chrome.
  Only the deterministic source image and its intrinsic aspect ratio change.
- No P0, P1, or P2 visual finding remains.

Comparison history:

1. Initial source and implementation captures used exact image-element masks.
2. Review found that a viewer-sized mask also covered the overlaid close
   control, weakening the evidence.
3. All Plan 0160 captures were repeated with deterministic media and no masks.
4. The empty-state Dialog evidence was removed after product review established
   that an image-less Shot must not expose the action or Dialog.
5. Exact Playwright comparisons passed for every unchanged state, and the
   unmasked same-input review found no unexplained visible difference.
6. The broad pre-existing `scene-narrative.png` compatibility snapshot still
   reports the same 101-pixel text antialiasing drift around the `SHOT PLANS`
   tab that was captured before implementation. Its baseline was not changed;
   it is unrelated to the Plan 0160 surfaces.

final result: passed
