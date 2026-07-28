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
