# 0145 Unified Studio Media Card Architecture

Status: complete
Date: 2026-07-16

## Summary

Replace every competing Studio implementation of a visual media card with one
domain-neutral `MediaCard` implementation owned by `packages/studio/src/ui`.

This is a consistency and ownership refactor, not a redesign. The shared
component must preserve each included surface's current dimensions, layout,
aspect ratio, fitting, copy, activation, and state treatment.

The only approved visual changes are:

1. every card selection control is persistent in the lower-right;
2. every card delete control uses one shared top-right treatment.

No other visual change is approved. Generation Preview keeps its current
three-column layout, card sizing, aspect treatment, fitting, copy, and picker
behavior. Shot Design keeps its current tile sizes, grayscale behavior, footer
labels, and hover-video behavior.

This plan changes frontend presentation architecture only. It does not change
Core asset relationships, generation reference semantics, provider contracts,
project storage, or media data models.

## Accepted Product Decisions

1. `MediaCard` is the accepted public component name.
2. The explicit inclusion and exclusion inventories below control scope.
3. A surface not listed in either inventory must not be inferred into scope.
   Stop and update this plan before migrating it.
4. Click-to-preview behavior, border, radius, or shadow alone do not make an
   image a card.
5. Images embedded in application chrome or a larger detail layout remain
   feature-owned presentation media.
6. Included cards use one shared selection control and one shared delete
   control.
7. Top-right is reserved for delete.
8. Lower-right renders selection first and Edit second when both exist.
9. Feature code may map domain data into `MediaCard`, but it may not render
   competing card chrome, visual media, selection controls, delete controls, or
   Edit controls.
10. The public contract models only the current included Studio card use cases.
    It does not expose arbitrary renderers, class-name escape hatches, generic
    action slots, or speculative presentation combinations.
11. The completed change contains one supported visual-card implementation.
    Temporary direct caller migration during implementation is allowed, but no
    wrapper, alias, compatibility path, or obsolete implementation may remain.
12. Verification is desktop-only.

## Controlling Surface Inventory

### Included

The following surfaces must use `MediaCard`:

| Product area | Surface | Card role |
| --- | --- | --- |
| Cast | Cast overview grid | One Cast Member content-navigation card |
| Cast | Profile Images | One attached or generated profile-image asset |
| Cast | Character Sheets | One attached or generated Character Sheet |
| Locations | Location overview grid | One Location content-navigation card |
| Locations | Hero Images | One attached or generated hero-image asset |
| Locations | Location Sheets | One attached or generated Location Sheet |
| Production Lookbook | Sample Images | One attached or generated sample image |
| Production Lookbook | Lookbook Sheets | One attached or generated Lookbook Sheet |
| Storyboard Lookbook | Sample Images | One attached or generated sample image |
| Storyboard Lookbook | Lookbook Sheets | One attached or generated Lookbook Sheet |
| Inspiration | Inspiration folder grid | One Inspiration folder content-navigation card |
| Inspiration | Folder grabs | One attached Inspiration image |
| Lookbook reports | Evidence grids | One report evidence image |
| Lookbook reports | Feature evidence | One prominent report evidence image |
| Lookbook reports | Storyboard hero | One labeled and optionally deletable report image |
| Scene Storyboard | Scene Beats | One Beat storyboard card |
| Act Storyboard | Beat thumbnails | One Beat content-navigation card |
| Sequence Storyboard | Scene mosaics | One Scene content-navigation card with a 2x2 mosaic |
| Project Library | Project cards | One project summary card with cover and structured body |
| Generation Preview | Typed visual references | One current or eligible visual reference |
| Generation Preview | Additional visual references | One read-only attached visual reference |
| Image Revision | Source and other visual references | The existing Generation Preview reference-card presentation |
| Reference Picker | Candidate grid | One eligible visual reference candidate |
| Shot Design | Composition and motion options | One selectable image or hover-video option |

### Excluded

The following surfaces must not use `MediaCard`:

| Product area | Surface | Reason |
| --- | --- | --- |
| Cast | Cast Member detail feature portrait | Presentation media embedded in the detail layout |
| Locations | Location detail feature hero | Presentation media embedded in the detail layout |
| Studio sidebar | Project cover/navigation image | Application chrome owned by sidebar navigation |
| Any | `ImagePreviewDialog` | Full preview surface |
| Any | `VideoPlayer` and `ShotVideoPreview` | Media players |
| Screenplay dialogue | Cast portrait in a tooltip | Supporting tooltip image |
| App chrome | Renku logo and brand imagery | Branding |
| Upload surfaces | File upload button and dropzone | Asset-creation affordances |
| Cast and Scenes | Voice Sample and Dialogue Audio cards | Audio interaction contract |
| Lookbook reports | Palette, tone, tags, prose, and property widgets | Non-media report content |
| Workflow panels | Empty stage panels with no media item | Workflow state, not a media card |

Excluded surfaces may continue to use raw `<img>` or `<video>` elements inside
their owning feature component. They may not copy `MediaCard` merely to obtain a
second visual-card implementation.

## Required UX Preservation

The shared implementation must preserve the current desktop presentation below.

| Surface | Frame and fit | Copy and body | Activation and state |
| --- | --- | --- | --- |
| Cast overview | `1:1`, cover | Existing bottom overlay | Open Cast Member |
| Location overview | `4:3`, cover | Existing bottom overlay | Open Location |
| Cast Profile Images | Current square/detected ratio, cover; `240px` minimum | Existing quiet copy | Preview; Select lower-right; Delete top-right |
| Cast Character Sheets | Current `4:3`/detected ratio, contain; `384px` minimum | Existing overlay copy | Preview; Edit lower-right; Delete top-right |
| Location Hero Images | Current `16:9`/detected ratio, cover; `320px` minimum | Existing quiet copy | Preview; Select lower-right; Delete top-right |
| Location Sheets | Current `4:3`/detected ratio, contain; `480px` minimum | Existing summary copy | Preview; Edit lower-right; Delete top-right |
| Lookbook Sample Images | Current `16:10`/detected ratio, cover; `300px` minimum | Existing quiet copy | Preview; Edit lower-right; Delete top-right |
| Lookbook Sheets | Current `4:3`/detected ratio, contain; `480px` minimum | Existing quiet copy | Preview; Edit lower-right; Delete top-right |
| Inspiration folders | Current ratio; `240px` minimum; current gap | Existing name/count overlay | Open folder; Delete top-right |
| Inspiration grabs | Current ratio; `180px` minimum; current gap | No raw filename overlay | Preview; Delete top-right; preserve Upload tile position |
| Report evidence | Current `16:9`, `320px` minimum-height, or intrinsic frame | Existing label or long-form overlay | Preview; Delete top-right |
| Scene Beats | `16:9`, cover | Existing Beat overlay | Select Beat; preserve selected emphasis |
| Act storyboard | `4:3`, cover | Shared overlay title/Beat label | Open Beat; preserve empty state |
| Sequence storyboard | `4:3`, fixed 2x2 mosaic | Shared overlay title/metadata | Open Scene; preserve empty cells |
| Project Library | `16:9`, cover | Existing title, project name, logline, issue, and metrics | Open project; preserve disabled state |
| Generation Preview | Current fixed three-column grid, current aspect and fit | Existing meaningful label hygiene | Existing picker/read-only behavior; Select lower-right |
| Reference Picker | Current `220px` minimum and gap | Existing meaningful title | Choose candidate; preserve selected emphasis |
| Shot Design | Current video/square ratio and minimum widths | Existing footer label | Whole-card toggle; Select lower-right; preserve hover video |

### Shared selection treatment

The selection control:

- is persistent for selected and unselected states;
- is always in the lower-right;
- uses one circular selected/unselected treatment;
- exposes `aria-pressed`;
- uses the existing selected and unselected labels supplied by the feature;
- does not change card dimensions or copy layout.

### Shared delete treatment

The delete control:

- is always in the top-right;
- uses one `28px` rounded trigger;
- uses a translucent dark background and white trash icon;
- changes to the destructive treatment on hover;
- appears on card hover and keyboard focus;
- uses a tooltip and meaningful accessible label;
- opens the shared `DeleteConfirmDialog`;
- preserves product-specific confirmation title, message, and callback.

## Context

Accepted architecture and design guidance:

- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/coding-practices.md`
- `docs/product/design-guidelines.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `docs/decisions/0037-use-playwright-for-studio-browser-e2e.md`

Relevant active plans:

- `plans/active/0111-generation-preview-dialog-redesign.md`
- `plans/active/0131-generation-preview-prompt-editor-and-reference-update.md`
- `plans/active/0133-image-revision-dialog-and-generation-provenance.md`
- `plans/active/0136-studio-ui-compatibility-and-generation-backend-integration.md`
- `plans/active/0143-flexible-generation-authoring-and-editable-take-media.md`
- `plans/active/0144-scene-beats-and-shot-authoring-reset.md`

Relevant package:

- `packages/studio`

Real verification project:

- `$HOME/renku-movies/urban-basilica`

Existing browser coverage:

- `packages/studio/e2e/tests/compatibility/studio-ui.compat.spec.ts`
- `packages/studio/e2e/tests/smoke/media-card-surface.smoke.spec.ts`
- `packages/studio/e2e/tests/smoke/project-library.smoke.spec.ts`
- `packages/studio/e2e/tests/regression/visual-language.regression.spec.ts`

## Architecture Shape Gate

### Ownership

`packages/studio/src/ui/media-card/` owns:

- card chrome and the four accepted presentation treatments;
- image, video, 2x2 mosaic, and bounded empty-state rendering;
- ratio, intrinsic, and minimum-height frames;
- overlay, label, feature-overlay, footer, and summary-body presentations;
- whole-card activation layering;
- selected emphasis;
- selection, Edit, and delete control rendering and placement.

Feature code owns:

- selecting the domain asset or option;
- constructing URLs, alt text, labels, and summary values;
- choosing one accepted media, frame, and presentation contract;
- preview, navigation, selection, Edit, and deletion callbacks;
- domain filtering, ordering, and resource refresh.

### Lean module shape

```text
packages/studio/src/ui/media-card/
  media-card.tsx
  media-card-contract.ts
  media-card-visual.tsx
  media-card-actions.tsx
  media-card-grid.tsx
  media-card.test.tsx
  media-card-grid.test.tsx

packages/studio/src/ui/
  media-collection-section.tsx
```

Responsibilities:

- `media-card.tsx`
  - public `MediaCard`;
  - composes the root frame, presentation, activation layer, visual, and actions;
  - contains no feature or domain branching.
- `media-card-contract.ts`
  - public contracts only;
  - exposes only the current accepted media, frame, presentation, activation,
    selection, Edit, delete, and empty-state shapes.
- `media-card-visual.tsx`
  - renders image, video, fixed 2x2 mosaic, and bounded empty-state visuals;
  - owns fit, runtime aspect detection, hover zoom, Shot Design desaturation,
    Generation Preview hover playback, and Shot Design hover-muted-loop
    playback.
- `media-card-actions.tsx`
  - renders the shared selection, Edit, and delete controls;
  - owns action placement, event isolation, tooltip, pressed state, and delete
    confirmation.
- `media-card-grid.tsx`
  - public `MediaCardGrid`;
  - owns the existing auto-fill layout with deliberate minimum width and bounded
    gap.
- `media-collection-section.tsx`
  - public collection composition for asset tabs;
  - owns heading, count, empty section state, grid, and stable item keys;
  - does not own domain filtering or actions.

Do not create separate selection, delete, frame, or copy files before their
implementation becomes independently substantial. If `media-card.tsx` or
`media-card-actions.tsx` begins accumulating unrelated responsibilities, stop
and split the relevant responsibility deliberately.

### Public entrypoints

Callers import directly from:

- `@/ui/media-card/media-card`
- `@/ui/media-card/media-card-contract`
- `@/ui/media-card/media-card-grid`
- `@/ui/media-collection-section`

There is no `index.ts`, barrel, alias, wrapper, or re-export facade.

### Accepted UI discriminants

`MediaCard` may branch only on:

- media kind: `image`, `video`, or `mosaic`;
- empty-state kind: `image`, `film`, or `waveform`;
- frame kind: `ratio`, `intrinsic`, or `minimum-height`;
- presentation kind: `overlay`, `thumbnail`, `evidence`, or `summary`;
- evidence-copy kind: `label` or `feature`;
- presence of activation, selection, Edit, or delete.

These are the current UI anatomies. Do not add a new discriminant unless a
listed in-scope caller cannot be represented correctly without it.

### Explicitly forbidden

Do not:

- add a `custom` media, presentation, action, or empty-state renderer;
- add arbitrary `ReactNode` action or visual slots;
- add caller-supplied card, visual, action-zone, or typography class names;
- add domain variants such as `cast`, `location`, `lookbook`, `projectLibrary`,
  `generationReference`, or `shotDesign`;
- add independent styling knobs that create untested presentation combinations;
- let features import internal selection, Edit, or delete controls;
- move preview-dialog, asset-deletion, or domain-selection rules into `src/ui`;
- preserve an old component through a wrapper or alias;
- migrate any excluded surface;
- build every future media-card capability before a current caller requires it.

### Stop conditions

Stop and revise the plan if:

- a surface requires an arbitrary renderer or class-name escape hatch;
- an internal module branches on product domains or asset roles;
- an excluded image is being migrated because it happens to have a border,
  shadow, or preview click;
- a new configuration option has no current caller;
- a feature still renders card chrome or card-owned `<img>`/`<video>` markup
  after its migration;
- `media-card.tsx` becomes a detailed switchboard instead of a shallow
  composition;
- visual parity is attempted through feature-local CSS duplication.

## Public Contracts

The implementation must use these public names and shapes. If a listed field
proves unnecessary or a current caller requires a missing field, stop and
update this plan before changing the public contract.

### `MediaCard`

```ts
export interface MediaCardProps {
  media: MediaCardMedia | null;
  frame: MediaCardFrame;
  presentation: MediaCardPresentation;
  activation?: MediaCardActivation;
  selected?: boolean;
  selection?: MediaCardSelection;
  editAction?: MediaCardEditAction;
  deleteAction?: MediaCardDeleteAction;
  emptyState?: MediaCardEmptyState;
}
```

Rules:

- `selection.selected` is the selected state when selection exists;
- `selected` supports selected cards without a visible selection control and is
  omitted when `selection` exists;
- activation, selection, Edit, and delete are sibling controls and never nested
  buttons;
- selection renders before Edit in the lower-right;
- delete is the only top-right action;
- the presentation discriminant prevents unsupported copy/body combinations.

### Media

```ts
export type MediaCardMedia =
  | MediaCardImage
  | MediaCardVideo
  | MediaCardMosaic;

export interface MediaCardImage {
  kind: 'image';
  src: string;
  alt: string;
  fit: 'cover' | 'contain';
  loading?: 'lazy';
  effect?: 'none' | 'zoom-on-hover' | 'desaturate-until-hover-or-selected';
}

export type MediaCardVideo =
  | {
      kind: 'video';
      src: string;
      title: string;
      playback: 'hover-muted' | 'still';
    }
  | {
      kind: 'video';
      src: string;
      title: string;
      posterSrc: string;
      playback: 'hover-muted-loop';
    };

export interface MediaCardMosaic {
  kind: 'mosaic';
  cells: readonly [
    MediaCardMosaicCell,
    MediaCardMosaicCell,
    MediaCardMosaicCell,
    MediaCardMosaicCell,
  ];
}

export interface MediaCardMosaicCell {
  id: string;
  src?: string;
  alt: string;
}
```

The mosaic is deliberately fixed to the current Sequence storyboard 2x2 use
case and uses the current cover fitting. Video uses the current cover fitting.
There is no generic row/column, video-fit, or custom renderer contract.

### Frame

```ts
export type MediaCardFrame =
  | {
      kind: 'ratio';
      aspectRatio: number;
      detectFromImage?: boolean;
    }
  | {
      kind: 'intrinsic';
    }
  | {
      kind: 'minimum-height';
      minimumHeightPx: number;
    };
```

The numeric ratio is the only ratio source. Callers do not pass competing
Tailwind aspect classes.

### Presentation

```ts
export type MediaCardPresentation =
  | {
      kind: 'overlay';
      copy?: {
        title?: string;
        description?: string;
      };
  }
  | {
      kind: 'thumbnail';
      footer?: {
        eyebrow?: string;
        title: string;
        description?: string;
      };
  }
  | {
      kind: 'evidence';
      copy?:
        | {
            kind: 'label';
            label: string;
          }
        | {
            kind: 'feature';
            title?: string;
            description: string;
          };
  }
  | {
      kind: 'summary';
      body: MediaCardSummaryBody;
    };
```

Each presentation owns its current chrome, typography, spacing, gradient, and
truncation. The contract does not expose independent styling knobs.

### Project summary body

```ts
export interface MediaCardSummaryBody {
  title: string;
  subtitle?: string;
  description?: string;
  issue?: {
    code: string;
    message: string;
  };
  metrics?: Array<{
    label: string;
    value: string | number;
  }>;
}
```

This is the current Project Library content shape. It does not accept arbitrary
React content or interactive controls.

### Activation and actions

```ts
export interface MediaCardActivation {
  label: string;
  disabled?: boolean;
  onActivate: () => void;
}

export interface MediaCardSelection {
  selected: boolean;
  selectedLabel: string;
  unselectedLabel: string;
  onToggle: () => void | Promise<void>;
}

export interface MediaCardEditAction {
  label: string;
  onEdit: () => void;
}

export interface MediaCardDeleteAction {
  label: string;
  confirmationTitle: string;
  confirmationMessage: string;
  onDelete: () => Promise<void>;
}
```

### Empty state

```ts
export interface MediaCardEmptyState {
  kind: 'image' | 'film' | 'waveform';
}
```

These variants cover the current missing image, missing storyboard/option
poster, and Voice Over Cast overview treatments. There is no arbitrary
placeholder visual.

### Grid and collection

```ts
export interface MediaCardGridProps {
  children: ReactNode;
  minimumCardWidthPx: number;
  gap?: 'compact' | 'standard' | 'roomy';
}

export interface MediaCollectionItem {
  id: string;
  card: MediaCardProps;
}
```

`MediaCollectionSection` accepts:

- title;
- meaningful empty title;
- existing image count copy;
- `MediaCollectionItem[]`;
- minimum card width;
- bounded gap.

## Implementation Slices

### Slice 0: Lock current desktop behavior

Before visual migration:

1. Retain the existing Cast Assets, Location Assets, Lookbook Assets, and Scene
   Beats compatibility screenshots.
2. Add screenshots or focused DOM assertions for:
   - Project Library;
   - Cast and Location overview grids;
   - Inspiration folders and grabs;
   - Production and Storyboard Lookbook evidence;
   - Act storyboard;
   - Sequence storyboard;
   - Shot Composition and Shot Motion options;
   - Generation Preview visual references;
   - multi-candidate Reference Picker.
3. Do not mask card chrome, actions, copy, state, or dimensions.
4. Add focused assertions for the approved deltas:
   - every visible selection control is lower-right;
   - every delete control uses the shared top-right treatment.

Exit:

- every included treatment has a baseline capable of detecting unintended size,
  fit, layout, copy, and interaction changes.

### Slice 1: Add the base card through a real caller

Add:

- the lean `src/ui/media-card/*` module;
- image, Generation Preview video, ratio frame, overlay presentation,
  activation, selected emphasis, selection, delete, and image empty-state
  support;
- focused unit tests.

Migrate these proving callers:

- Reference Picker for activation and selected emphasis;
- Generation Preview reference cards for selection;
- Inspiration folder cards for delete.

Do not add Edit, waveform/film empty states, evidence, summary-body, mosaic,
Shot Design poster video, looping playback, or desaturation support in this
slice.

Exit:

- the base contract is exercised by production feature code and contains no
  speculative capability.

### Slice 2: Replace the current shared overlay-card path

Migrate:

- Cast and Location overview grids;
- Scene Beats;
- Inspiration grabs;
- remaining Generation Preview and Image Revision visual-reference callers;
- Cast, Location, and Lookbook asset collections.

Add `MediaCollectionSection` with stable item keys. Move selection, Edit, and
delete configuration into the typed contracts. Add the waveform empty state
when migrating Cast overview.

Preserve Generation Preview's current:

- fixed three-column grid;
- aspect and fitting;
- card dimensions;
- singleton and multi-candidate picker behavior;
- read-only additional-reference behavior;
- audio-only card path.

Delete after the last caller moves:

- `src/ui/image-overlay-card.tsx`
- `src/ui/image-selection-control.tsx`
- `src/ui/image-collection-section.tsx`
- `src/features/movie-studio/visual-language/grab-card.tsx`
- `src/features/image-revision/image-revision-card-action.tsx`
- `src/features/movie-studio/voice-over-profile-preview.tsx`

Exit:

- no production caller imports the old overlay card, selection control,
  collection section, Grab card, or feature-owned Edit control.

### Slice 3: Add the report evidence treatment

Add only the current report requirements:

- evidence presentation with label and feature copy;
- minimum-height and intrinsic frames.

Migrate:

- `EvidenceGrid`;
- feature evidence cards;
- Storyboard Lookbook hero.

Preserve report layout, evidence ordering, labels, prose, preview behavior, and
delete callback behavior. The feature remains responsible for closing the
matching preview after deletion.

Exit:

- Lookbook reports contain no independent visual-card shell, media rendering,
  or delete-control implementation.

### Slice 4: Add thumbnail, mosaic, and summary treatments

Add only:

- thumbnail presentation with footer copy;
- fixed 2x2 mosaic media;
- summary presentation with typed Project Library body.

Migrate:

- Act Beat thumbnails;
- Sequence Scene mosaics;
- Project Library cards.

Do not migrate Cast or Location detail feature images or the Studio sidebar
cover.

Exit:

- Act, Sequence, and Project Library use `MediaCard` without a generic body or
  mosaic renderer.

### Slice 5: Add the current Shot Design video treatment

Add only:

- poster image plus hover-muted-loop video;
- idle desaturation restored on hover or selection;
- square and video ratio use through the existing frame contract.

Migrate `OptionTileGroup` to configure `MediaCard` directly while preserving
its selection semantics and grid sizing.

Delete:

- `src/ui/option-tile.tsx`

Exit:

- Shot Design uses the shared persistent lower-right selection control and has
  no private card or media rendering.

### Slice 6: Consolidate grids and remove dead code

Replace visual-card uses of:

- `src/ui/image-card-grid.tsx`
- `src/features/movie-studio/visual-language/visual-language-card-grid.tsx`

with `MediaCardGrid`.

Replace the excluded Voice Sample use of `ImageCardGrid` with its current direct
feature-owned grid layout; do not migrate the audio card itself.

Delete:

- `src/ui/image-card-grid.tsx`
- `src/features/movie-studio/visual-language/visual-language-card-grid.tsx`
- `src/features/movie-studio/screenplay-media/screenplay-image-card.tsx`
- `src/features/movie-studio/screenplay-media/screenplay-primary-image.tsx`
- `src/features/movie-studio/screenplay-media/screenplay-image-card-grid.tsx`

Audit remaining raw `<img>`, `<video>`, and `Card` uses against the explicit
included and excluded inventories. If a result is not listed, stop and update
this plan instead of inferring its scope.

Exit:

- exactly one implementation remains for every included visual-card surface.

### Slice 7: Documentation and final verification

Create:

- `docs/decisions/0053-use-one-configurable-studio-media-card.md`

Update:

- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/product/design-guidelines.md`

Document:

- the explicit included and excluded surface lists;
- the four accepted presentation treatments;
- selection lower-right;
- Edit lower-right after selection;
- delete top-right with one shared treatment;
- card activation behind sibling controls;
- the ban on feature-owned card chrome and arbitrary render slots.

Do not update historical plans or Studio skill documentation.

## Tests And Guardrails

### Unit tests

Add focused tests proving:

- image cover and contain fitting;
- ratio, runtime-detected, intrinsic, and minimum-height frames;
- overlay, thumbnail, evidence, and summary presentations;
- fixed four-cell mosaic ordering and empty cells;
- Generation Preview hover-video and Shot Design hover-muted-loop behavior;
- desaturation restoration on hover and selection;
- image, film, and waveform empty states;
- meaningful activation label;
- selected emphasis;
- persistent lower-right selection with `aria-pressed`;
- lower-right Edit placement after selection;
- shared top-right delete treatment and confirmation dialog;
- child actions do not trigger whole-card activation;
- disabled card activation prevents its callback;
- no nested buttons;
- stable collection item keys;
- `MediaCardGrid` minimum width and gap behavior.

### Feature tests

Update or add tests for:

- Cast profile pick and Location hero pick toggling both ways;
- image revision opening without opening image preview;
- delete confirmation and post-delete preview cleanup;
- Cast and Location overview navigation;
- Scene Beat selected state and navigation;
- Act empty and populated cards;
- Sequence mosaic ordering;
- Project Library disabled validation card;
- Inspiration preview, delete, and Upload tile placement;
- Generation Preview singleton, clearing, multi-candidate picker, and read-only
  additional references;
- Shot Design whole-card and visible-control toggling;
- Shot Motion hover-video start and stop.

### Browser regression

Review each included surface for:

- width, height, aspect ratio, and fit;
- grid columns, minimum widths, gaps, and wrapping;
- border, radius, shadow, and hover/focus state;
- overlay, footer, evidence label, and summary body;
- missing-media state;
- preview or navigation activation;
- selection lower-right;
- Edit lower-right;
- delete top-right with the shared treatment.

Snapshot changes are allowed only where selection moves or delete styling
becomes consistent.

### Architecture guardrails

Add stable import-boundary coverage proving:

- `src/ui/media-card/*` does not import from `src/features`, `src/services`,
  server modules, or Core domain services;
- feature code consumes the UI module without the UI module knowing feature
  domains.

Do not add tests that enumerate caller or private implementation names.

Use this review audit:

```bash
rg -n "<img|<video|<Card|ImageOverlayCard|ImageCardGrid|ImageSelectionControl|OptionTile" \
  packages/studio/src/features packages/studio/src/ui
```

Inspect every result against the explicit inventory. The audit is not a brittle
source-name architecture test.

### Complexity guardrail

Before completion:

- confirm every public option has a current included caller;
- confirm no arbitrary renderer, action slot, style override, or generic
  row/column mosaic exists;
- confirm the four presentation treatments remain bounded;
- confirm `media-card.tsx` remains shallow;
- confirm actions remain focused in `media-card-actions.tsx`;
- split a module only when its implementation has become independently
  substantial;
- confirm no large switchboard or nested ternary renderer was introduced.

## Final Verification

Run:

```bash
pnpm --dir packages/studio test:typecheck
pnpm --dir packages/studio lint
pnpm --dir packages/studio test
pnpm --dir packages/studio test:integration
pnpm --dir packages/studio test:e2e:smoke
pnpm --dir packages/studio test:e2e:compat
pnpm build:studio
pnpm check
```

Perform desktop verification against
`$HOME/renku-movies/urban-basilica`:

1. Project Library.
2. Cast overview.
3. Cast Profile Images and Character Sheets.
4. Location overview.
5. Location Hero Images and Location Sheets.
6. Inspiration folders and grabs.
7. Production Lookbook evidence and Assets.
8. Storyboard Lookbook evidence and Assets.
9. Scene Beats.
10. Act storyboard.
11. Sequence storyboard.
12. Shot Composition options.
13. Shot Motion options.
14. Generation Preview singleton reference.
15. Generation Preview multi-candidate picker.
16. Generation Preview read-only additional references.
17. Image Revision references.

Confirm the excluded Cast detail image, Location detail image, Studio sidebar
cover, preview dialog, players, tooltip image, upload surfaces, and audio cards
remain outside `MediaCard`.

Final architecture-shape review:

- inspect `git diff --stat`;
- inspect the complete diff;
- inspect every new or heavily modified `src/ui/media-card` file;
- confirm the module matches the lean Architecture Shape Gate;
- confirm no `index.ts`, wrapper, alias, or compatibility facade exists;
- confirm no feature/domain import entered `src/ui/media-card`;
- confirm every deleted implementation is gone;
- confirm excluded surfaces were not migrated;
- confirm selection and delete are the only intentional visual changes;
- confirm no checklist item was satisfied by accepting unreviewable structure.

## Completion Checklist

### Scope And Review

- [x] Use the explicit included and excluded inventories as the only scope
      authority.
- [x] Confirm every included surface uses `MediaCard`.
- [x] Confirm every excluded surface remains feature-owned presentation media.
- [x] Confirm no unlisted surface was inferred into scope.
- [x] Confirm the completed Studio has one included visual-card implementation.

### Architecture And Contracts

- [x] Add the lean `src/ui/media-card` module shape.
- [x] Add only the current image, video, fixed mosaic, frame, presentation,
      activation, selection, Edit, delete, and empty-state contracts.
- [x] Keep selection and Edit lower-right.
- [x] Keep delete top-right with one shared treatment.
- [x] Keep product logic in feature folders.
- [x] Add no arbitrary renderer, React action slot, class override, domain
      variant, speculative option, wrapper, alias, or re-export facade.
- [x] Add no Core, server, persistence, or generation-domain changes.

### UX Preservation

- [x] Preserve every included surface's current dimensions and grid.
- [x] Preserve aspect ratios, runtime detection, cover/contain fitting, and
      cropping.
- [x] Preserve copy, overlay, footer, evidence, summary, and empty-state
      presentation.
- [x] Preserve preview, navigation, whole-card toggle, disabled, hover,
      focus, and selected behavior.
- [x] Move every selection control to the persistent lower-right position.
- [x] Standardize every delete control to the shared top-right treatment.
- [x] Make no other intentional visual change.

### Implementation Slices

- [x] Complete baseline coverage.
- [x] Add the base card through a real Reference Picker migration.
- [x] Migrate and delete the current shared overlay-card path.
- [x] Add and migrate report evidence treatment.
- [x] Add and migrate thumbnail, mosaic, and summary treatments.
- [x] Add and migrate the Shot Design video treatment.
- [x] Consolidate grids and delete dead code.
- [x] Complete documentation and final verification.
- [x] Add each capability only when its migration slice requires it.

### Deletions

- [x] Delete `src/ui/image-overlay-card.tsx`.
- [x] Delete `src/ui/image-selection-control.tsx`.
- [x] Delete `src/ui/image-collection-section.tsx`.
- [x] Delete `src/ui/image-card-grid.tsx`.
- [x] Delete `src/ui/option-tile.tsx`.
- [x] Delete `src/features/image-revision/image-revision-card-action.tsx`.
- [x] Delete `src/features/movie-studio/voice-over-profile-preview.tsx`.
- [x] Delete `src/features/movie-studio/visual-language/grab-card.tsx`.
- [x] Delete
      `src/features/movie-studio/visual-language/visual-language-card-grid.tsx`.
- [x] Delete the three unused `screenplay-media` card/grid files.
- [x] Retain Cast and Location detail feature-image implementations.
- [x] Retain the Studio sidebar project-cover implementation.

### Tests And Guardrails

- [x] Add focused `MediaCard`, `MediaCardGrid`, and collection tests.
- [x] Update feature tests for every migrated interaction.
- [x] Retain and review existing compatibility screenshots.
- [x] Add the missing included-surface desktop coverage.
- [x] Add stable UI import-boundary coverage.
- [x] Run the raw-media/card audit and inspect every result.
- [x] Confirm there are no nested controls.
- [x] Confirm keyboard and screen-reader labels remain meaningful.
- [x] Confirm every public option has a current caller.
- [x] Confirm no architecture test freezes caller or private implementation
      names.

### Documentation

- [x] Add ADR 0053.
- [x] Update current frontend architecture documentation.
- [x] Update current frontend guidelines.
- [x] Update current design guidelines.
- [x] Do not edit historical plans or Studio skill documentation.

### Final Verification

- [x] Run Studio typecheck, lint, unit, integration, smoke, and compatibility
      suites.
- [x] Run `pnpm build:studio`.
- [x] Run root `pnpm check`.
- [x] Verify every included Urban Basilica surface.
- [x] Verify excluded surfaces remain outside `MediaCard`.
- [x] Review `git diff --stat` and the complete diff.
- [x] Inspect all new and heavily modified files.
- [x] Confirm the final module remains lean and reviewable.
- [x] Confirm the obsolete card implementations are gone.
- [x] Confirm selection and delete are the only visual deltas.
- [x] Only then mark this plan complete.
