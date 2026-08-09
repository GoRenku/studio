# Design QA — Create Project Dialog

**Source visual truth**

- `plans/active/assets/0175-studio-empty-project-creation-dialog/selected-dialog.png`
- Source pixels: 1487 × 1058.

**Rendered implementation**

- `plans/active/assets/0175-studio-empty-project-creation-dialog/implementation-dialog.jpg`
- Implementation pixels: 1488 × 1059.
- CSS viewport: 1488 × 1059 at device scale factor 1.
- State: populated Project Library, dark theme, Create project dialog open,
  Project title focused with `The Glass Harbor`, and the suggested Folder name
  visible.
- Density normalization: none required. The one-pixel source/viewport variance
  is below the fidelity threshold and does not change the dialog comparison.

**Full-view comparison evidence**

- `plans/active/assets/0175-studio-empty-project-creation-dialog/design-qa-comparison.png`
- The selected centered-modal composition, overlay, header action placement,
  modal width, and dominant yellow primary action are preserved.
- The live Project Library card and header geometry use the existing Studio
  components and current Basilica data rather than ImageGen's incidental card
  proportions and invented values.

**Focused region comparison evidence**

- `plans/active/assets/0175-studio-empty-project-creation-dialog/design-qa-dialog-comparison.png`
- A focused dialog comparison was required because field spacing, focus state,
  footer geometry, and copy are too small to judge reliably in the full view.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the implementation uses Studio's existing font stack,
  weights, and text tokens. Hierarchy and wrapping match the reference closely;
  the minor weight difference is an accepted live-design-system constraint.
- Spacing and layout rhythm: the final 570 px modal width, 563 px rendered
  height, body padding, footer height, and button placement align with the
  reference. The existing Dialog header/footer separators are intentionally
  retained.
- Colors and visual tokens: the dark panel, dimmed overlay, border hierarchy,
  muted copy, yellow focus outline, and yellow primary action use current
  Studio tokens and preserve the selected direction.
- Image quality and asset fidelity: no new raster assets are required by the
  dialog. Existing Renku logo, Project card media treatment, and Lucide UI icons
  remain source-quality app assets rather than approximations.
- Copy and content: app-specific text follows the accepted implementation plan.
  `Automatically suggested` accurately describes the editable UI behavior,
  and the initialization note deliberately promises only the Project folder
  and database rather than the mock's inaccurate `core folders` claim.

**Comparison history**

1. Initial implementation evidence used a 560 px modal with a compressed
   footer and a neutral title-field focus treatment. These were P2 fidelity
   differences against the selected dialog.
2. The modal was widened to 570 px, footer vertical padding and button height
   were increased, and the focused input adopted the Studio primary accent.
3. The post-fix full-view and focused-region comparisons listed above show the
   selected geometry and interaction emphasis without actionable P0/P1/P2
   drift.

**Primary interactions tested**

- Header action opens the dialog.
- Initial focus lands on Project title.
- Typing a title derives the Folder name and resolved location.
- Escape dismisses the dialog when idle.
- Reopening after dismissal resets both fields.
- Cancel dismisses the dialog.
- The temporary-storage browser E2E journey creates the Project, navigates to
  Project Information, returns home, and finds the new card.
- Browser console errors checked: none.

**Open Questions**

- None.

**Implementation Checklist**

- [x] Match the selected desktop modal composition and state.
- [x] Preserve Studio design-system typography, colors, controls, and icons.
- [x] Keep corrected, product-accurate initialization copy.
- [x] Verify focus, derivation, dismissal, reset, and successful creation flow.

**Follow-up Polish**

- No P3 follow-up is required for this slice.

final result: passed
