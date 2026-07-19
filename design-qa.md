# Design QA — Image Generation Review

## Scope And Evidence

- Source visual truth:
  `plans/active/assets/0149-image-generation-review-design/`.
- Production route:
  `http://localhost:5173/projects/urban-basilica/locations/location_g9s9246r`
  and the previously verified Production Lookbook route.
- Desktop viewport: 1708×1251.
- Themes: dark and light.
- Production states checked: Generation Preview Prompt, References, and Config;
  Image Revision Regenerate Prompt, References, and Config; Image Revision Edit
  Prompt, References, and Config.
- Final screenshots:
  `/Users/keremk/.codex/visualizations/2026/07/18/019f76c1-a102-7b72-8e4d-e14ae19409de/preview-{dark,light}-{prompt,references,config}-final.png`
  and
  `/Users/keremk/.codex/visualizations/2026/07/18/019f76c1-a102-7b72-8e4d-e14ae19409de/revision-{regenerate,edit}-{dark,light}-{prompt,references,config}-final.png`.
- Same-viewport combined comparisons:
  `final-preview-prompt-comparison.png`,
  `final-regenerate-config-comparison.png`, and
  `final-edit-references-comparison.png` in the same visualization folder.
- Focused comparisons:
  `final-config-controls-comparison.png` and
  `final-footer-comparison.png` in the same visualization folder.
- Follow-up Chrome implementation capture after the user's visual review:
  `/Users/keremk/.codex/visualizations/2026/07/18/019f76c1-a102-7b72-8e4d-e14ae19409de/location-preview-final-approved.png`.
- Follow-up same-viewport full comparison:
  `location-preview-source-final-comparison.png` in the same visualization
  folder.
- Follow-up focused header/tab comparison:
  `location-preview-header-tabs-final-comparison.png` in the same visualization
  folder.

## Findings And Corrections

The first production comparison found five actionable visual issues. All were
corrected and rechecked against combined source/implementation evidence.

1. **P1 — collapsed Image Revision content.** The dialog declared three grid
   rows while rendering four direct grid children, which let the tab bar consume
   most of the flexible height and reduced the request editor to roughly 90px.
   The dialog now declares header, request tabs, flexible content, and footer as
   four explicit rows. The 1120×760 frame remains stable across every state.
2. **P2 — Config layout drift.** Config used a nested tinted card and controls
   stretched too widely. The nested card was removed and the form now uses the
   compact centered label/control rhythm shown in the source. The focused
   comparison confirms the row spacing, widths, borders, and alignment.
3. **P2 — reference-card scale and labels.** Reference cards were undersized and
   their labels were too conversational. Cards now use the intended 420px grid
   width with quiet uppercase section labels. The Edit source remains visibly
   locked without adding invented copy.
4. **P2 — sepia dialog surfaces.** Global Studio theme tokens made the request
   dialogs warmer than the neutral graphite/near-white source. A dialog-scoped
   token treatment now produces neutral surfaces and readable foreground colors
   in both themes without changing the surrounding Studio UI.
5. **P2 — raw source identifier in the title.** A kebab-case asset identifier
   appeared as visible header copy. The dialog now shows a supplied meaningful
   title when available and otherwise uses the intentional `Revise Image`
   fallback.
6. **P1 — header and request-tab geometry did not match the approved source.**
   The live Preview header measured 45px rather than 54px; the request tabs
   started at the dialog border rather than the source's 14px inset; tabs used
   8px rather than 12px horizontal padding; the selected background was
   overridden to transparent; and the underline sat 5px below the tab. Preview
   now uses the source's 54px centered header, Image Revision keeps its 72px
   header, the tab row is 46px high with a 14px inset, selected Prompt is 79px
   wide, the selected fill is `rgba(189, 139, 43, 0.2)`, and the 2px underline
   sits at the tab's bottom edge. The selected tab begins at x=309 in both the
   source and implementation at the 1708×1251 viewport.
7. **P2 — prompt headings and editor surface drifted from the approved palette.**
   Live Markdown headings were orange `rgb(212, 162, 115)` at weight 400 instead
   of the source's desaturated gold `rgb(224, 195, 111)` at weight 700. The
   editor also introduced a rounded bordered card and blue active-line fill not
   present in the source. Headings now use the approved gold and weight, Markdown
   markers use the quiet gray `#858993`, the document is a transparent unboxed
   surface, and the active-line fill is transparent.

The prototype's Image Revision header thumbnail is an explicitly rejected
planning artifact. The production implementation intentionally does not restore
it; the accepted header contains meaningful text and mode controls only.

No actionable P0, P1, or P2 visual differences remain.

## Fidelity Review

- **Typography:** neutral document text remains readable; tab, mode, estimate,
  label, and action hierarchy matches the source. Markdown headings now use the
  approved desaturated-gold weight and gray markers. Token styling changes
  presentation only and preserves the exact authored prompt.
- **Spacing and layout:** the stable desktop frame, header, tab row, flexible
  editor, and 72px footer remain fixed across all modes and tabs. The source's
  header heights, 46px tab row, 14px tab inset, tab padding, 38px References and
  Config top rhythm, and centered form geometry are now measured matches.
- **Color and contrast:** dialog surfaces are neutral in dark and light themes;
  the source's graphite header/tab/content/footer surfaces are mapped through
  dialog-scoped tokens. Gold remains reserved for document hierarchy, selection,
  focus, and primary action emphasis.
- **Images:** production project assets are used directly with correct crops and
  no placeholder or reconstructed imagery.
- **Copy:** no raw filename, model id, provider payload, debug field, subtitle,
  or filler label is exposed. Config contains only Core-projected product
  controls.

## Interaction And Runtime Verification

- Prompt, References, and Config navigation passed in Preview, Regenerate, and
  Edit.
- Regenerate/Edit mode switching passed and preserved the stable frame.
- Edit showed the exact source image as a required locked reference; Regenerate
  references remained selectable.
- Typing `@Ref` opened one exact selected-reference completion. Enter replaced
  only the active query with `@Reference1`; one undo restored `@Ref`.
- Hover/caret entry displayed the real selected image preview. Unknown or
  cleared mention text was not rewritten.
- Config showed only the route's declared controls: Nano Banana 2 exposed
  Aspect ratio and Resolution; GPT Image 2 Edit exposed Image size and Quality.
- Estimate and primary actions remained stable through loading and resolved
  states.
- Final browser logs contained only Vite connection messages and the React
  development-tools notice; no warning or error was emitted by the flow.
- Follow-up Chrome warning/error logs after the geometry and color corrections
  were empty.

## Verification

- Studio: 62 test files and 210 tests passed.
- Root `pnpm check`, `pnpm lint`, and `pnpm test` passed. Lint reports the existing
  non-blocking `packages/studio/server/bin.ts` console warning and no errors.
- Studio Skills guide validation passed for 8 image routes, 10 image purposes,
  and the forward-test cases against the `urban-basilica` project.
- Studio and Studio Skills diffs passed `git diff --check`.

final result: passed
