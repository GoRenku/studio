# Design QA — Shot Brief Tabs Alternative

This file preserves the complete iteration record. The production correction
record below supersedes earlier treatments where they differ. The original
mockup remains the source for visual proportions, card treatment, imagery,
tabs, and transient dialogs; the explicit corrective feedback is authoritative
for the integrated Scene header, Beat-chip copy, exact Shot title, technical
brief values, media controls, description inset, and fixed-width Brief cards.

## Production correction: integrated Shot Plan detail

### Corrected requirements

- The existing Scene heading is the one and only page heading.
- The existing Scene tabs remain visible in detail; only the Shot Plans
  tab-panel content switches from collection to detail.
- Back occupies the current Scene header action slot.
- No route breadcrumb, repeated Scene heading, or Shot Plan title header is
  rendered.
- The heading is the exact authored Shot title, `Urban Before the Empire`.
- The Shot title occupies its own row. Covered Beat pills sit in a separate row
  directly underneath it and read only `Beat N`.
- Camera shows the authored `Eye-Level` angle.
- Optics shows the authored 24 mm lens, Deep depth of field, and focus target.
- Start and End framing are independent image-preview triggers.
- Motion has no visible `Preview` label.
- Description text has a deliberate horizontal inset inside its frame.
- Brief cards use the fixed `SHOT_BRIEF_CARD_WIDTH_PX` value and wrap without
  shrinking or stretching.

### Production comparison evidence

- Latest fixed-card production view at 1024 × 900:
  `/private/tmp/shot-plans-fixed-cards-1024.png`.
- Latest same-viewport comparison against
  `screenshots/compact-wrapped-brief-grid.png`:
  `/private/tmp/shot-plans-fixed-cards-1024-comparison.png`.
- Production Brief at 1440 × 900:
  `/private/tmp/shot-plans-final-1440x900.png`.
- Paired 1440 × 900 comparison:
  `/private/tmp/shot-plans-compare-1440.png`.
- Production Brief at 1024 × 900:
  `/private/tmp/shot-plans-final-1024x900.png`.
- Paired 1024 × 900 comparison:
  `/private/tmp/shot-plans-compare-1024.png`.
- Production Description:
  `/private/tmp/shot-plans-corrected-description-final.png`.
- Browser geometry measured 25 pixels from the Description frame edge to the
  editor host and text.
- At 1024 × 900, all five Brief cards measure exactly 204 pixels wide and wrap
  into two columns instead of shrinking or stretching.
- The Shot title precedes the Covered Beats group in document order, and the
  Beat row starts below the title at the same left edge.
- The Shot rail resolves to its 210-pixel hard minimum at the compact viewport.

### Runtime checks

- The Chrome accessibility tree contains one Scene heading, the persistent
  Narrative/Beats/Shot Plans/Generations tab row, the exact Shot title, and
  only `Beat 1` for the covered Beat.
- The Camera card contains `Eye-Level`.
- The Optics card contains `Lens 24 mm`, `Depth Deep`, and the authored focus
  target.
- The Motion card contains no visible `Preview` text.
- End opens an End-framing dialog and Start opens a Start-framing dialog;
  closing returns focus to the exact trigger.
- Focused React tests cover the stable Scene tabs/header action, independent
  framing triggers, no Motion preview copy, technical optics values, Beat-only
  labels, fixed-width card tracks, and Description inset.

### Findings

No actionable P0, P1, or P2 mismatch remains against the corrective feedback.

final result: passed

The preserved earlier iteration history follows.

## Comparison target

- Source visual truth: the six annotated Browser screenshots attached to the
  2026-07-27 user feedback turn, plus the explicit request for a tabbed
  Brief/Description alternative.
- Brief implementation:
  `screenshots/brief-tab.png`
- Description implementation:
  `screenshots/description-tab.png`
- Viewport and CSS size: 1315 × 1198.
- Source pixels: 1315 × 1198 for each annotated Browser capture.
- Implementation pixels: 1315 × 1198 for both captured states.
- Density normalization: source and implementation were compared at their
  matching 1× Browser capture size.
- Theme/state: Renku Studio dark theme; Brief is the default tab; Description
  is the alternate active tab.

## Full-view comparison evidence

- The existing Shot Plan surface, header, Beat chips, rail proportions,
  resize handle, Shot title, imagery, card order, typography, and dark neutral
  palette remain unchanged from the annotated source.
- The header explanation, repeated Shot number beside the title, rail
  `Shot 4 of 7` copy, standalone `Brief` label, and stacked description preview
  have been removed as requested.
- The selected rail item now uses the accepted amber active background and
  amber border around the complete Shot item.
- Brief and Description now use one LineTabs-like row directly beneath
  `Anna reads the letter`.
- The five brief cards remain in one row and are 284 pixels tall, reduced from
  312 pixels without truncating their authored values.
- The Description tab provides a 458-pixel editor frame with a 400-pixel
  independently scrollable reading region and 2,260 characters of realistic
  Markdown content.

## Focused region comparison evidence

- Shot title region: only the authored title remains; the duplicate `Shot 4`
  label is gone.
- Rail selection region: the full item, including image and authored title,
  receives amber selection treatment; the existing number badge still
  communicates Shot 4.
- Tabs region: the selected tab uses the project's amber underline and both
  tabs preserve the compact uppercase typography of current Studio tabs.
- Brief region: image crops, icons, card order, text hierarchy, and optics
  metadata remain unchanged; only vertical density was reduced.
- Description region: the compact stacked preview is replaced by a dedicated
  read-only Markdown editor surface with generous padding, line height,
  visible format/read-only metadata, selectable text, and internal scrolling.

## Required fidelity surfaces

- Fonts and typography: preserved Montserrat-style UI typography and
  Geist Mono-style editor typography. Removed duplicate labels improve title
  hierarchy. Tab labels use 10-pixel uppercase text with 0.12em tracking.
- Spacing and layout rhythm: tabs sit 13 pixels below the Shot title; content
  begins 16 pixels below the tab divider. Brief cards remain equal height at
  284 pixels. Description receives the full content region.
- Colors and tokens: dark neutral surfaces and quiet borders are preserved.
  Selection now uses `item-active-bg`, `item-active-border`, and the amber
  primary underline rather than green or a new color.
- Image quality and assets: all original bundled Shot Design images and the
  Push In motion clip remain unchanged and retain their existing crops.
- Copy and content: all annotated redundant copy was removed. Authored Shot,
  Brief, Beat, and Markdown content remains meaningful product/domain text.

## Interaction and runtime checks

- Brief is the initial selected tab.
- Clicking Description swaps the panel without changing the detail surface or rail.
- Left/right arrow keys move between Brief and Description and update focus.
- The Description editor has `scrollHeight: 587` and `clientHeight: 400`, so
  long content scrolls inside the stable editor frame.
- Motion preview still plays on keyboard focus and resets to the poster after
  reload.
- No horizontal page overflow was found.
- Browser console warning/error check returned no entries.

## Comparison history

1. Earlier source findings:
   redundant Brief label, repeated Shot number, explanatory header copy,
   repeated rail position copy, missing full-item amber selection, overly tall
   brief cards, and insufficient room for realistic descriptions.
2. Fixes:
   removed the redundant copy, wrapped the selected rail item in the current
   amber treatment, reduced brief-card height from 312 to 284 pixels, and
   introduced working Brief/Description tabs with a dedicated long-form editor.
3. Post-fix evidence:
   `brief-tab.png` and `description-tab.png` at the same 1315 × 1198 viewport
   show the revised states with no remaining P0, P1, or P2 mismatch against the
   annotated direction.

## Findings

No actionable P0, P1, or P2 findings remain.

## Iteration 6: In-page Shot Plan navigation

### Comparison target

- Source visual truth:
  `screenshots/navigation-wireframe.png`.
- Browser-rendered Shot Plans collection:
  `screenshots/iteration-6-shot-plans-list.png`.
- Browser-rendered Shot Plan detail:
  `screenshots/iteration-6-shot-plan-detail.png`.
- Normalized, side-by-side collection comparison:
  `screenshots/iteration-6-list-comparison.png`.
- Normalized, side-by-side detail comparison:
  `screenshots/iteration-6-detail-comparison.png`.
- Source pixels: 8963 × 3716. The left and right wireframe screens were
  cropped independently, proportionally resized into 1440 × 900 canvases, and
  compared with their corresponding implementation state.
- Implementation pixels and CSS viewport: 1440 × 900 at 1× for both states.
- Theme: Renku Studio dark theme.
- States: Scene `Shot Plans` collection, followed by the selected Shot Plan
  in-page detail route.

### Full-view comparison evidence

- The collection preserves the wireframe's Scene title, Narrative/Beats/Shot
  Plans/Generations tab row, active Shot Plans state, and multiple clickable
  plan cards. The implementation applies the accepted Studio `LineTabs` and
  `MediaCard` visual language rather than copying the wireframe's sketch
  styling.
- Plan activation replaces the Scene tab surface with a full-width in-page
  detail. There is no modal backdrop, focus trap, floating close affordance,
  or dialog footer.
- The detail route places Back and the
  `01 · The First Patron → Shot Plan` breadcrumb above the existing accepted
  Shot Plan surface.
- The plan title, covered Beats, Shot rail, selected and empty image states,
  Brief/Description tabs, five cards, media inspection, and education actions
  remain visually unchanged inside the new route.

### Focused region comparison evidence

- Navigation header: the implementation preserves the wireframe's Back-first
  hierarchy and scene-to-feature breadcrumb while using the existing compact
  Button/icon language.
- Collection transition: both plan cards are keyboard-accessible, clicking a
  card pushes `#shot-plan/the-letter-intimate-coverage`, and the selected plan
  route receives focus on Back.
- Return behavior: Back pushes `#shot-plans`, restores the collection, and
  returns focus to the invoking plan card. Browser Back/Forward also switches
  correctly between the two states.
- Detail tabs: Description remains independently selectable after the route
  change; the active tab and panel stay synchronized.

### Required fidelity surfaces

- Fonts and typography: the existing Studio typography and uppercase compact
  navigation treatment remain consistent. The breadcrumb establishes the
  route without competing with the authored Shot Plan title.
- Spacing and layout rhythm: the route header sits outside the bordered detail
  surface; the inner header, rail, tabs, grid, and vertical rhythm are
  unchanged from Iteration 5.
- Colors and tokens: the Scene tab and route header use the existing neutral
  surfaces, amber active underline, focus ring, borders, and subdued
  Generations state.
- Image quality: real storyboard and Shot Design assets fill the collection
  mosaics and detail media. No placeholder shapes or generated CSS artwork
  replace visible image content.
- Copy and content: Scene name, Shot Plan titles, coverage, breadcrumb, Beat
  names, and Shot content are meaningful domain copy. No ids, filenames, or
  prototype instructions leak into the product surface.

### Runtime and accessibility checks

- Click plan → detail → Back completes the primary flow.
- Browser Back/Forward preserves the same navigation states.
- Back returns keyboard focus to the plan card that opened the detail.
- Each plan entry opens with Brief selected, regardless of the tab used during
  the previous detail visit.
- Brief/Description tab activation still exposes exactly one selected panel.
- Generations remains visible and disabled.
- The Browser console reported no warnings or errors.
- The existing media-preview, Beat-hover, empty-state, responsive-grid,
  glossary, and reduced-motion checks remain applicable because their
  underlying markup and behavior were preserved.

### Findings and comparison history

- Earlier product-level mismatch: the accepted detailed surface was mounted as
  a modal Dialog, while the new wireframe requires primary in-page navigation.
- Fix: added the Scene Shot Plans collection, URL-backed list/detail states,
  Back action, scene-to-Shot-Plan breadcrumb, focus restoration, and browser
  history support; removed the detailed surface's dialog framing semantics.
- Post-fix evidence: both normalized comparison images preserve the wireframe's
  information architecture while the rendered implementation retains the
  previously accepted high-fidelity detail design.

No actionable P0, P1, or P2 findings remain.

### Follow-up polish

No P3 change is proposed before user review.

final result: passed

## Follow-up polish

No P3 change is proposed before user review; nearby layout and styling were
intentionally preserved.

## Iteration 3 — Responsive grid and preview interactions

### Latest source truth

- The six annotated Browser screenshots attached to the subsequent user
  feedback turn.
- Requested changes: replace the amber rail background with a thick amber
  image border, remove the repeated rail title, keep five columns wide while
  wrapping cards at smaller widths, open Framing/Camera/Motion media in a large
  dialog, and show storyboard images from Beat hover/focus triggers.

### Latest implementation evidence

- Wide default:
  `screenshots/iteration-3-wide.png`
- Wrapped 1024-pixel view:
  `screenshots/iteration-3-tablet.png`
- Beat image hover/focus state:
  `screenshots/iteration-3-beat-hover.png`
- Large still-image dialog:
  `screenshots/iteration-3-image-dialog.png`
- Large Motion dialog:
  `screenshots/iteration-3-motion-dialog.png`
- Wide viewport: 1440 × 900 CSS pixels and implementation pixels at 1×.
- Wrapped viewport: 1024 × 900 CSS pixels and implementation pixels at 1×.

### Latest comparison findings and fixes

1. Earlier P2: the selected Shot background dominated the rail.
   Fix: removed the item background and title, then applied a 3-pixel amber
   border directly to the selected image.
2. Earlier P2: cards compressed into unreadably narrow five-column tracks.
   Fix: changed the Brief grid to bounded 172-pixel minimum tracks. It renders
   five 197-pixel cards at 1440 and a 3+2 arrangement of 229-pixel cards at
   1024 with no horizontal overflow.
3. Earlier P2: visual vocabulary media could not be inspected.
   Fix: made both Framing images, Camera media, and Motion media
   keyboard-reachable large-preview triggers. Still and motion previews use one
   shared dialog treatment; the motion clip plays successfully in the dialog.
4. Earlier P2: covered Beat chips did not supply the planned visual context.
   Fix: attached real storyboard images to all three Beat chips and made the
   previews available on hover and keyboard focus.

### Latest fidelity and runtime checks

- Typography, card content, card order, tabs, description editor, and Shot Plan
  header remain unchanged.
- The wide grid has five columns; the 1024-pixel grid has three cards followed
  by two cards.
- The rail title is absent and the selected media border is 3 pixels using the
  current amber primary token.
- Framing Start, Framing End, Camera, and Motion triggers have specific
  accessible labels.
- The large preview restores focus to its trigger when closed and closes by
  close control, backdrop, or Escape.
- Beat previews use actual 1024-pixel storyboard images and resolve on
  hover/focus.
- The large Motion video reached ready state 4 and played after the
  user-triggered open action.
- No horizontal overflow or Browser console warnings/errors were found in the
  tested wide and 1024-pixel states.

No actionable P0, P1, or P2 findings remain in iteration 3.

## Iteration 4: Shot rail empty state

### Evidence

- Source visual truth:
  `screenshots/iteration-3-wide.png`
- Browser-rendered implementation:
  `screenshots/iteration-4-empty-shot.png`
- Combined full-view comparison:
  `screenshots/iteration-4-comparison.png`
- Viewport and pixel dimensions: 1440 × 900 CSS pixels and implementation
  pixels at 1×.
- State: Brief tab active, Shot 4 selected, Shot 5 without selected media.

### Findings and checks

- No P0, P1, or P2 findings. The added Shot preserves the existing rail width,
  spacing rhythm, typography, colors, card proportions, and five-column Brief
  layout.
- Shot 4 retains its 3-pixel amber selection border. Shot 5 uses a quiet
  1-pixel neutral border, the same 16:9 media footprint, and the Lucide
  `ImageOff` symbol without inventing a title or filename.
- The Shot 5 number and 6-second duration remain visible so the empty media
  state can still be identified and scanned.
- Focused comparison was limited to the Shot rail because the rest of the
  implementation is pixel-identical to the iteration 3 source capture.
- DOM verification found two rail cards, the rendered empty-state icon, no
  horizontal overflow, and no unintended rail copy. Browser error logs were
  empty.

## Iteration 5: Visual glossary dialogs

### Evidence

- Source visual truth:
  `screenshots/iteration-4-empty-shot.png`
- Browser-rendered closed state:
  `screenshots/iteration-5-wide-help-buttons.png`
- Combined full-view comparison:
  `screenshots/iteration-5-comparison.png`
- Camera glossary:
  `screenshots/iteration-5-camera-glossary-wide.png`
- Motion glossary:
  `screenshots/iteration-5-motion-glossary.png`
- Primary viewport and pixel dimensions: 1440 × 900 CSS pixels and
  implementation pixels at 1×.
- Responsive verification viewport: 1024 × 900 CSS pixels at 1×.

### Findings and checks

- No P0, P1, or P2 findings. The closed-state comparison preserves the
  existing type, spacing, card width, image crop, palette, and content. Only
  the three requested 28-pixel help controls and their reserved lower padding
  are added.
- Framing renders all 9 canonical shot-size illustrations, with Medium
  Close-Up marked `Start` and Close-Up marked `End`.
- Camera renders all 8 canonical camera-angle illustrations, with Eye-Level
  marked `Current`.
- Motion renders all 10 canonical movement terms, with Push In marked
  `Current`. Nine existing motion previews are attached; Rack Focus uses a
  purpose-made visual glossary illustration matching the bundled Shot Design
  art direction.
- The 1440-pixel dialogs render five equal columns without clipping. At 1024
  pixels the Motion glossary wraps to four columns without horizontal or
  vertical overflow.
- All 27 glossary images loaded successfully. Dialog count, current-state
  markers, close behavior, Escape behavior, focus return, and the three
  category-specific accessible labels were checked.
- Typography remains the existing Montserrat/Inter stack. Dialog hierarchy,
  small labels, and option names remain legible at both tested widths.
- Colors continue to use the existing neutral surfaces and amber semantic
  selection accent; no competing state color was introduced.
- Browser error logs were empty.

final result: passed
