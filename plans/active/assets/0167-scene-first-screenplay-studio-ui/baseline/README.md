# Scene-First Screenplay Studio Baseline

Captured: 2026-08-03

Project: `urban-basilica`

Surface: the running canonical Studio dev server at `http://localhost:5173`

Capture conditions:

- viewport: 1440×900;
- theme: current light theme;
- primary Scene: `scene_djkfgf9p`, **01 - Bombardment**;
- primary tab: Narrative;
- Acts and the selected Sequence expanded where shown; and
- screenshots contain the visible desktop viewport, sidebar, main surface, and
  footer unless a panel intentionally occupies part of the viewport.

The numbered screenshots preserve the pre-Plan-0166 state needed by Plan 0167.
They cover Project Information, footer counts, Act and Sequence organization,
the Bombardment Narrative, Cast and Location mention behavior, dialogue card
states, the dialogue-audio workspace, Scene tabs, Scene navigation, Story Arc,
Cast, Locations, and Props.

The binary captures are intentionally not tracked in the Studio repository.
They are preserved in the local `urban-basilica/.renku/review-evidence/`
archive; the filenames below remain stable evidence identifiers.

## Current-behavior limits

- Selecting a Sequence currently forces that Sequence open. Clicking its
  disclosure while it is selected does not leave it collapsed, so screenshot
  `06-sequence-collapsed.png` records the attempted current state and the
  neighboring collapsed Sequence treatment. Plan 0167 must test the accepted
  independent selection/disclosure behavior against this limitation.
- Cast image preview is available from a dialogue cue and is captured in
  `09-cast-hover-preview.png`.
- Location mentions currently navigate but do not render an image hover preview.
  `08-location-hover-preview.png` records that missing current behavior. Plan
  0167 explicitly owns adding reference-driven Location and Prop previews.
- Bombardment has no Shot Plans or generated videos, so the corresponding
  captures preserve the current empty states.

See [interaction-matrix.md](interaction-matrix.md) for the interaction-level
baseline and evidence map.
