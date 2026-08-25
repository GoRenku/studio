# Design QA — Media Generation Request Dialog

## Visual truth and implementation captures

- User-provided visual truth: the prior Prompt, References, and rich Configuration screenshots attached to the 2026-08-24 implementation review.
- Repository prompt reference: `tmp/design-qa/media-generation-dialog/prompt-editor-dark-normal-chromium-regression-darwin.png` (1120 × 624).
- Final Prompt comparison: `tmp/design-qa/media-generation-dialog/final-prompt-comparison.png`. The left side is the prior checked-in prompt treatment; the right side is the final 1120 × 760 dialog crop from the user's Chrome session.
- Configuration iteration comparison: `tmp/design-qa/media-generation-dialog/final-configuration-before-after.png`. The left side is the rejected generic text-row implementation; the right side is the restored rich-control composition.
- Final Inspection captures:
  - `tmp/design-qa/media-generation-dialog/restored-inspection-prompt.png`
  - `tmp/design-qa/media-generation-dialog/restored-inspection-references-loaded.jpg`
  - `tmp/design-qa/media-generation-dialog/restored-inspection-configuration.png`
- Final Preview captures:
  - `tmp/design-qa/media-generation-dialog/restored-preview-prompt.png`
  - `tmp/design-qa/media-generation-dialog/restored-preview-configuration.png`
- Browser and viewport: the user's existing Google Chrome session, 1733 × 1255 screenshot viewport, dark theme, desktop layout. Focused dialog comparisons use the exact rendered 1120 × 760 dialog crop.

## States and interactions tested

- Saved video request Prompt tab with the real Urban Basilica first- and last-frame tokens.
- Saved video request References tab with both real Urban Basilica images fully loaded.
- Saved image request Configuration tab with provider, model, four string/number values, and one boolean.
- Editable Preview Prompt and Configuration tabs through the same complete dialog shell.
- Prompt, References, and Configuration tab navigation.
- Reference image-preview activation and Escape dismissal.
- Close action.
- Browser console warnings and errors after the interaction pass: none.

## Comparison results

- Dialog shell: passed. Preview and Inspection both render the same complete owner for the 1120 × 760 frame, 54px header, 46px line-tab row, scrollable content region, footer, close controls, and Preview-only Update action.
- Prompt layout: passed. The implementation restores the prior borderless editor, 790px reading measure, horizontal centering, top spacing, paragraph rhythm, and footer separation. The combined image confirms the content begins at the same focused-dialog x position as the prior reference. No added thin outline remains around the prompt.
- Prompt typography and color: passed. Existing CodeMirror typography and authored paragraph breaks are preserved. Reference mentions use the prior teal presentation color. Header and tabs retain the uppercase tracked treatment and gold selected state.
- References: passed. The shared overlay `MediaCard` composition renders a quiet two-column image grid. Both registered project images load at their intrinsic 1672 × 941 dimensions. No filename, domain slot, generated role label, character label, or location label is visibly rendered. Both cards open the image preview.
- Configuration composition: passed. The rejected bordered provider/model summary and separator rows are gone. The restored view uses the former centered 538px control column, 150px label column, 360px control column, 18px vertical rhythm, 38px top inset, local shadcn read-only Inputs, and a disabled shadcn Switch for the boolean value.
- Configuration truthfulness: passed. The UI reconstructs presentation only from provider, model, JSON nesting, insertion order, and JSON value type. It does not recreate schemas, provider/model field maps, select options, slider ranges, units, capabilities, defaults, or fake one-option controls. Unknown strings and numbers remain read-only Inputs; booleans remain disabled Switches; nested objects/arrays remain ordered groups; null and bounded fallback JSON are explicit.
- Preview/Inspection parity: passed. Chrome captures show the same geometry, tab styling, content placement, and footer treatment for both paths. Their only intentional difference is Preview's editable prompt and Update action.
- Accessibility: passed. Tabs remain semantic keyboard controls, the prompt retains its accessible textbox label and read-only state in Inspection, configuration values stay available through labelled form controls, and the visually quiet reference cards keep alt text and preview-button labels.
- Desktop resilience: passed at the product-supported desktop viewport. Mobile behavior was not evaluated because Renku Studio is desktop-first and mobile support was not requested.

## Iteration history

1. Rejected the generic Configuration renderer because it removed the prior control composition and replaced it with raw text rows.
2. Rejected partial sharing because Preview and Inspection shared only the tab body while duplicating the dialog shell.
3. Restored one complete shared dialog owner and moved Preview/Inspection differences into state and action props.
4. Restored the prior Prompt geometry and token color treatment without semantically interpreting or changing prompt text.
5. Restored References through the existing `MediaCard` overlay presentation, removed visible filenames, and verified both real images and the image-preview interaction.
6. Added a schema-free JSON projection and the prior rich read-only Input/Switch layout without inventing unavailable semantics.
7. Compared the prior Prompt and final Prompt in one combined image, compared rejected/final Configuration in one combined image, and rechecked the final states in the user's Chrome session.

final result: passed
