# 0160 Reusable MediaCard Preview And Collection Dialogs

Status: complete
Date: 2026-07-28
Completed: 2026-07-28

## Summary

Make image preview and card-collection dialogs consistent extensions of the
shared Studio `MediaCard` system.

The Shot rail must preserve its primary navigation behavior: activating a rail
card selects that Shot and never opens an image preview. When the Shot has image
candidates, its separate bottom-right image action opens the candidate-image
flow:

- zero images keeps the placeholder rail card quiet with no image action or
  dialog;
- one image opens the shared large image viewer directly because there is
  nothing to choose;
- multiple images open a reusable card-collection dialog;
- activating an image card inside that dialog opens the same shared large image
  viewer used elsewhere in Studio;
- the lower-right choose control selects the canonical Shot image without also
  activating the card;
- the existing unselected-only recoverable delete behavior remains unchanged.

The smallest architecture-correct change is to extend the existing
`packages/studio/src/ui/media-card/` owner. `MediaCard` receives a semantic,
container-selected image-preview activation that composes the existing shared
`ImagePreviewDialog`. A new domain-neutral
`MediaCardCollectionDialog` renders prepared `MediaCard` items and common
loading, error, empty, and ready states. Shot and Reference Picker features
retain domain fetching and mutations, but stop implementing their own dialog
and card-grid anatomy.

This extraction is an internal refactor everywhere except the explicitly
requested Shot behavior. Existing MediaCard surfaces, Reference Picker,
candidate-dialog chrome, and the large image viewer must retain their current
layout, dimensions, spacing, copy, typography, colors, borders, radii, image
treatment, and action placement. The implementation begins by locking
same-state visual baselines and finishes only after Product Design comparison
finds no unexplained visible regression.

This is a frontend interaction and consistency change. It does not change Core
Asset ownership, canonical selection, Shot Plan storage, HTTP routes, browser
DTOs, or generation-reference semantics.

## Requirement Ledger

| Requirement | Source | Planned result |
| --- | --- | --- |
| Rail-card activation must remain available for selecting among multiple Shots. | User correction | `ShotPlanShotRail` keeps callback activation whose only effect is selecting the Shot. |
| The rail image must not open a viewer when the card itself is activated. | User correction | No image-preview activation is configured on the rail card. |
| The bottom-right rail action owns Shot-image inspection and choice. | User correction | The existing corner action opens the feature-owned Shot candidate container. |
| One Shot image should open large without a selection step. | User correction | The Shot container maps a ready one-item collection directly to the shared image viewer. |
| Multiple Shot images should open a selection dialog. | User correction | The Shot container maps a ready multi-item collection into `MediaCardCollectionDialog`. |
| Candidate-card activation should open the large viewer. | User correction | Candidate cards opt into the shared semantic image-preview activation. |
| The choose icon, not card activation, changes the selected Shot image. | User correction plus ADR 0064 canonical-selection boundary | Candidate cards retain one-way lower-right selection controls; only their callbacks call the existing selection mutation. |
| Preview and selection mechanisms must be implemented once and reusable. | User correction | Preview activation and collection-dialog anatomy move into the shared `ui/media-card` module. |
| Containers decide whether activation means preview, callback behavior, or nothing. | User correction | `MediaCardActivation` becomes a bounded discriminated union selected by each caller. |
| The selection dialog must be reusable like `MediaCard`. | User question and correction | Add `MediaCardCollectionDialog`; refactor both Shot candidates and Reference Picker to consume it. |
| Reusable extraction must not redesign or visually normalize current surfaces. | User correction | Preserve each caller's existing Dialog frame, grid, card, viewer, copy, spacing, and interaction-state presentation through bounded shared presentation modes and locked visual baselines. |
| Design fidelity must be checked with the design workflow, not inferred from code or unit tests. | User correction and accepted Product Design workflow | Capture pre-refactor and post-refactor screenshots at identical desktop viewports and states, compare them together, and block completion on any unexplained visual difference. |
| Existing card actions must remain independent. | ADR 0053 and current tests | Selection, corner action, and delete remain sibling controls above whole-card activation and do not trigger preview or navigation. |
| Image-less Shot placeholders must not expose a meaningless detail action. | User correction after visual QA | Omit the lower-right image action when the Shot projection contains no image candidates; do not render an empty candidate Dialog. |
| Existing Shot candidate lifecycle behavior must remain. | Current accepted Plan 0157 behavior | Preserve lazy loading, retry, Core-owned selection, unselected-only Trash, refresh, and focus return for Shots with images. |
| Shared UI must remain domain-neutral. | Frontend architecture rules | `src/ui` receives prepared card props and callbacks, never Shot, Asset, Reference, service, or Core contracts. |

## Product Behavior

### Shot rail

- Clicking or keyboard-activating any Shot rail card selects that Shot.
- Rail-card activation does not open an image viewer.
- The upper-left Shot number, lower-left duration, selected amber border, and
  empty-image treatment remain unchanged.
- When image candidates exist, the lower-right image action is separately
  keyboard reachable and does not select the Shot.
- Activating that action opens the Shot-image flow for the exact Shot.

### Shot-image flow

- Candidate data continues to load lazily after the lower-right action is
  invoked.
- While candidates load, the reusable collection dialog keeps a stable frame
  and loading state.
- A request failure keeps the dialog open and exposes Retry.
- A Shot with zero image candidates shows only its placeholder rail card. The
  lower-right image action and candidate Dialog are omitted.
- Exactly one ready image replaces the collection frame with the shared large
  image viewer. It shows no choose icon because there is no alternative. It
  does not silently mutate canonical selection.
- Two or more ready images render the reusable collection dialog at the current
  `max-w-5xl`, `max-h-[65vh]`, and 220-pixel card-grid geometry.
- Activating a candidate card opens the shared large image viewer above the
  collection dialog.
- Closing the large viewer returns focus to the exact candidate card and leaves
  the collection dialog open.
- Activating an unselected card's lower-right choose control calls the current
  focused Shot selection mutation, refreshes the collection, rail image, and
  Shot Plan mosaic, and keeps the collection dialog open.
- The selected candidate keeps its labelled selected status and cannot be
  cleared from this one-way chooser.
- Delete remains top-right, recoverable, and available only on unselected
  candidates.
- Closing either the direct one-image viewer or multi-image collection returns
  focus to the exact rail image action.

### Reusable MediaCard behavior

Every container deliberately configures one of these whole-card activation
behaviors:

- `callback`: invoke caller-owned navigation, selection, or another product
  action;
- `image-preview`: open the shared large still-image viewer;
- omitted: render no whole-card activation target.

The shared component owns the activation target, preview open/close state,
viewer presentation, Escape/backdrop/close behavior, and focus return. The
container owns meaningful labels, browser-safe image data, and whether preview
is appropriate.

`MediaCardCollectionDialog` renders an ordered collection of prepared
`MediaCard` items. Each item's existing bounded card contract determines its
media, presentation, activation, selection, corner action, delete action, and
empty state. The dialog does not interpret domain objects or invent actions.

Reference Picker moves to this shared dialog while retaining its current
container choice: whole-card activation chooses a reference rather than opening
an image preview. This proves the shared dialog does not force Shot behavior on
other collections.

Current MediaCard-based image galleries that already open
`ImagePreviewDialog` migrate to the semantic `image-preview` activation and
delete their duplicated preview state:

- Cast Profile Images and Character Sheets;
- Location Hero Images and Location Sheets;
- Production and Storyboard Lookbook images and sheets;
- Inspiration grabs.

Pure presentation images that are not `MediaCard` surfaces may continue to
invoke the shared viewer directly.

### Visual preservation boundary

The current rendered design is the source of truth for every unchanged state.
Refactoring to shared ownership must not change:

- MediaCard aspect ratios, fixed/minimum widths, gaps, image fit, hover effect,
  overlay gradients, selected borders, copy, truncation, action icons, action
  positions, visibility rules, focus rings, radii, or shadows;
- Shot candidate Dialog width, maximum height, flush frame, header, scroll-body
  padding, 220-pixel card grid, loading/error presentation, or copy;
- Reference Picker's current inset frame, header, scroll-body padding,
  220-pixel grid, 16:10 cards, overlay titles, or whole-card choose behavior;
- the existing `ImagePreviewDialog` frame, image sizing, background, close
  control, backdrop, and motion;
- Cast, Location, Lookbook, and Inspiration gallery layout and preview
  presentation.

Only these visible/interactive Shot behavior constraints are accepted:

- an image-less Shot placeholder exposes no lower-right image action;
- the Shot rail's lower-right action branches to a direct viewer for one image
  and the candidate collection for multiple images;
- a card inside the multi-image candidate collection opens the existing large
  viewer;
- the existing lower-right choose control remains visually unchanged and is the
  only selection action.

The reusable collection Dialog therefore supports two bounded presentations:
the current flush Shot-candidate frame and the current inset Reference Picker
frame. It does not collapse them into one newly invented appearance.

## Explicit Non-Goals

This plan does not:

- make Shot rail image clicks open a viewer;
- change the selected Shot when only the lower-right image action is invoked;
- auto-select a sole candidate;
- change Asset ownership, selected-Asset validation, Trash, restore, or
  resource keys;
- add or change Studio HTTP routes, Core commands, browser DTOs, or database
  schema;
- turn generation-reference choice into canonical Asset selection;
- add video, audio, arbitrary media, or arbitrary React-content viewers;
- add caller class-name, action-node, dialog-body, or layout escape hatches;
- put feature fetching, sorting, selection rules, or mutations in `src/ui`;
- add URL state for preview or collection dialogs;
- redesign MediaCard visuals or support mobile layouts;
- normalize existing Dialog padding, header treatment, card aspect ratios,
  copy, or action placement merely because the implementation becomes shared;
- update screenshot baselines to accept an unexplained refactor difference.

## Context And Evidence

Accepted constraints:

- `docs/decisions/0053-use-one-configurable-studio-media-card.md`
- `docs/decisions/0064-use-exclusive-asset-membership-and-scoped-selection.md`
- `docs/decisions/0065-use-bounded-adaptive-media-card-mosaics.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/product/design-guidelines.md`
- `plans/active/assets/0157-shot-plans-studio-ui/index.html`, its stable
  screenshots, and its `design-qa.md`;
- project-root `design-qa.md`, which records the currently accepted Shot Plan
  production comparison;
- completed Plan 0145, which established `MediaCard` as the single shared
  visual-card implementation;
- completed Plan 0157, which established the current Shot rail and
  Shot-image-candidate behavior;
- completed Plan 0159, which established common Asset ownership and scoped
  canonical selection.

Current implementation evidence:

- `MediaCardActivation` is currently one callback shape; feature containers own
  all image-preview state.
- `ImagePreviewDialog` is shared, but it is outside the `media-card` module and
  its card callers repeat open-state and focus-return wiring.
- `ShotImageCandidatesDialog` directly composes `Dialog`, `MediaCardGrid`,
  candidate states, Shot fetching, selection, and deletion; it is not reusable.
- `ReferencePickerDialog` is a second feature-owned Dialog plus MediaCard grid.
- the two existing collection Dialogs intentionally render different frames:
  Shot candidates use a flush `p-0`/`gap-0` content frame with a padded
  scrolling body, while Reference Picker uses the current inset Dialog frame;
  a shared implementation must preserve both rather than silently choosing one;
- `MediaCollectionSection` already defines the useful
  `{ id, card: MediaCardProps }` composition used by repeated card surfaces.
- the Shot Plans list projection exposes enough candidate file metadata to
  decide whether the lower-right action exists; the existing lazy candidate
  query remains the source for the one-or-multiple ready-image flow.

## Architecture Shape Gate

### Ownership

`packages/studio/src/ui/media-card/` owns:

- the semantic activation union and whole-card activation layer;
- shared viewer activation and focus return;
- the reusable collection Dialog frame, header, card grid, and stable
  loading/error/empty/ready states;
- the two bounded visual presentations required to reproduce the existing
  flush Shot-candidate and inset Reference Picker designs exactly;
- interaction isolation between whole-card activation and sibling selection,
  corner, and delete actions.

Feature containers own:

- product data loading and refresh;
- candidate filtering and canonical order;
- meaningful titles, descriptions, labels, and empty/error copy;
- whether a card uses callback activation, image-preview activation, or no
  activation;
- whether a collection is shown at all;
- the Shot-specific no-action/one/multiple branch;
- canonical selection, delete, navigation, and retry callbacks.

### Intended module shape

```text
packages/studio/src/ui/media-card/
  media-card.tsx
  media-card-contract.ts
  media-card-activation.tsx
  media-card-actions.tsx
  media-card-visual.tsx
  media-card-grid.tsx
  media-card-mosaic-grid.tsx
  media-card-collection-dialog.tsx
  media-card.test.tsx
  media-card-collection-dialog.test.tsx
  media-card-grid.test.tsx

packages/studio/src/ui/
  image-preview-dialog.tsx
  media-collection-section.tsx

packages/studio/src/features/movie-studio/shot-plans/
  shot-plan-detail-page.tsx
  shot-plan-shot-rail.tsx
  shot-image-candidates-dialog.tsx
  use-shot-image-candidates.ts

packages/studio/src/features/reference-picker/
  reference-picker-dialog.tsx
  reference-picker-dialog.test.tsx

packages/studio/e2e/tests/compatibility/
  studio-ui.compat.spec.ts
  media-card-interactions.compat.spec.ts
```

Responsibilities:

- `media-card-contract.ts`
  - owns `MediaCardActivation`, `MediaCardImagePreviewActivation`,
    `MediaCardCallbackActivation`, `MediaCardCollectionItem`, and the collection
    Dialog state contract;
  - accepts no domain types or arbitrary renderer/action slots.
- `media-card-activation.tsx`
  - renders the shared activation `Button`;
  - invokes callback activation or opens the image viewer;
  - owns exact-trigger focus return;
  - contains no domain branching.
- `media-card.tsx`
  - remains a shallow composition of frame, visual, copy, actions, and the
    activation layer.
- `image-preview-dialog.tsx`
  - remains the shared domain-neutral large still-image viewer;
  - is composed by MediaCard preview activation, the Shot single-image branch,
    and non-card presentation-image callers;
  - does not gain card, collection, selection, or domain behavior.
- `media-card-collection-dialog.tsx`
  - renders one bounded Dialog frame and `MediaCardGrid`;
  - accepts ordered `MediaCardCollectionItem[]` and a discriminated
    loading/error/empty/ready state;
  - accepts one named flush or inset presentation and keeps the corresponding
    current Dialog and scroll-body classes internal;
  - accepts no children, arbitrary JSX, feature callbacks beyond prepared card
    props, or class-name overrides.
- `media-collection-section.tsx`
  - imports the shared `MediaCardCollectionItem` contract instead of retaining
    a duplicate item shape.
- `shot-image-candidates-dialog.tsx`
  - remains a feature adapter because it loads exact Shot candidates, maps
    Shot-specific card props, calls selection/delete services, and chooses
    direct viewer versus collection Dialog;
  - deletes its feature-local Dialog header/grid/action anatomy.
- `reference-picker-dialog.tsx`
  - remains a feature adapter because it maps generation-reference semantics;
  - deletes its duplicate Dialog and grid anatomy.
- `media-card-interactions.compat.spec.ts`
  - owns focused same-state Shot rail, candidate Dialog, Reference Picker,
    gallery preview, and large-viewer visual comparisons;
  - reuses the current deterministic E2E project and keeps the broader
    `studio-ui.compat.spec.ts` surface snapshots unchanged.

There is no new `index.ts`, barrel, wrapper, compatibility alias, registry, or
dispatcher.

### Public entrypoints

Callers import directly from:

- `@/ui/media-card/media-card`
- `@/ui/media-card/media-card-contract`
- `@/ui/media-card/media-card-collection-dialog`
- `@/ui/media-card/media-card-grid`
- `@/ui/image-preview-dialog`

### Bounded contract shape

```ts
export type MediaCardActivation =
  | MediaCardCallbackActivation
  | MediaCardImagePreviewActivation;

export interface MediaCardCallbackActivation {
  kind: 'callback';
  label: string;
  disabled?: boolean;
  onActivate: () => void;
}

export interface MediaCardImagePreviewActivation {
  kind: 'image-preview';
  label: string;
  disabled?: boolean;
  image: MediaCardPreviewImage;
}

export interface MediaCardPreviewImage {
  src: string;
  alt: string;
  title: string;
}

export interface MediaCardCollectionItem {
  id: string;
  card: MediaCardProps;
}

export type MediaCardCollectionDialogState =
  | { kind: 'loading'; message: string }
  | { kind: 'error'; message: string; retryLabel: string; onRetry: () => void }
  | { kind: 'empty'; message: string }
  | { kind: 'ready'; items: MediaCardCollectionItem[] };

export type MediaCardCollectionDialogPresentation =
  | { kind: 'flush' }
  | { kind: 'inset' };
```

`MediaCardCollectionDialog` additionally receives controlled `open`,
`onOpenChange`, meaningful `title` and `description`, and the accepted bounded
`minimumCardWidthPx` and gap contract already used by `MediaCardGrid`. Its
required `presentation` selects one current, tested layout without exposing
class names. It does not accept arbitrary content or styling.

All current callback activation callers move directly to `kind: 'callback'`.
There is no compatibility shape that recognizes the old untagged contract.

### ADR effect

Add Decision 0066 for semantic MediaCard preview activation and reusable
MediaCard collection dialogs.

Decision 0066 narrows Decision 0053 by replacing these clauses only:

- preview activation is no longer independently reimplemented by each feature;
- reusable card-collection Dialog anatomy now belongs to
  `src/ui/media-card`.

Decision 0053 continues to exclude pure preview media from card chrome and
the shared viewer remains a separate `src/ui` primitive. It also continues to
prohibit domain rules, arbitrary render slots, and feature/service imports in
`src/ui`. Add only a concise discoverability notice to Decision 0053; do not
rewrite its historical body.

### Forbidden shapes and stop conditions

Do not:

- make `MediaCard` fetch Assets or import feature, service, server, or Core
  modules;
- put Shot/reference branches in any `src/ui/media-card` file;
- add a generic modal framework or arbitrary Dialog body;
- add callbacks that both preview and select;
- infer selection from candidate count;
- add an activation branch for a speculative future media kind;
- keep duplicate feature-owned Dialog/grid implementations after migration;
- use the refactor to standardize visibly different existing surfaces;
- change MediaCard, collection Dialog, or viewer CSS unless the change is
  required by the new Shot interaction and covered by an accepted comparison;
- regenerate or loosen visual baselines to hide a difference;
- turn `media-card.tsx` into the preview and collection implementation.

Stop and split before implementation continues if:

- `media-card.tsx` becomes more than shallow composition;
- `media-card-activation.tsx` begins handling collection loading or mutations;
- `media-card-collection-dialog.tsx` needs domain-specific switches;
- the collection Dialog requires arbitrary JSX or class-name escape hatches;
- a feature adapter becomes a pass-through wrapper with no product mapping;
- a card action can accidentally trigger activation through event bubbling;
- an unchanged surface differs in layout, typography, spacing, color, image
  treatment, copy, or interaction presentation from its locked baseline;
- the Shot one/many branch requires a new server projection rather than the
  existing candidate query.

## Implementation Slices

### Slice 1: lock the design boundary

- Use the accepted Plan 0157 artifact and screenshots as the normative Shot
  Plan visual target.
- Before refactoring, capture deterministic current-production baselines for:
  - multi-Shot rail at 1440×900 and 1024×900;
  - image-less Shot placeholder without an action, plus Shot candidate loading,
    error, and multi-image ready states;
  - Reference Picker ready state;
  - Cast, Location, Lookbook, and Inspiration MediaCard galleries with the
    viewer closed and open;
  - the current large image viewer.
- Record exact viewport, state, source dimensions, and dynamic-media masks.
  Masks may cover exact media pixels and deterministic identifiers only, never
  layout, copy, controls, or whole components.
- Store package-owned Playwright baselines without updating them after the
  refactor unless the changed pixels are required by the two new Shot preview
  paths. The existing choose control is not an approved pixel change.

### Slice 2: accept the shared interaction boundary

- Add Decision 0066 and the narrow notice to Decision 0053.
- Update current frontend and design guidance to place semantic image preview
  and collection Dialog anatomy in `src/ui/media-card`.
- Keep historical plans unchanged; this plan is the current implementation
  direction.

### Slice 3: extend MediaCard activation

- Replace the untagged callback activation with the exact discriminated union.
- Add `media-card-activation.tsx` and keep `media-card.tsx` shallow.
- Compose the existing `ImagePreviewDialog`; do not fork or wrap its viewer
  presentation.
- Preserve the existing activation Button's DOM position and exact visual
  classes; this slice changes ownership and behavior selection, not card
  appearance.
- Make image-preview activation own open state, close behavior, and exact
  activation-trigger focus return.
- Update every current callback activation caller to `kind: 'callback'`.
- Move existing MediaCard-based image-gallery callers to
  `kind: 'image-preview'` and remove their duplicate preview state.

### Slice 4: add the reusable collection Dialog

- Move `MediaCardCollectionItem` into the shared contract and update
  `MediaCollectionSection`.
- Add `MediaCardCollectionDialog` with bounded loading/error/empty/ready states,
  existing Dialog anatomy, and `MediaCardGrid`.
- Implement the exact existing flush and inset presentations; do not normalize
  their padding, header, height, or scroll geometry.
- Refactor Reference Picker to prepare card items and use the shared dialog
  while keeping its inset appearance and whole-card callback choice behavior.

### Slice 5: apply the Shot behavior

- Keep Shot rail whole-card callback activation exclusively for Shot selection.
- Keep the lower-right action separate, omit it when the Shot projection has no
  image candidates, and otherwise use it to open the exact Shot's feature-owned
  candidate container.
- Refactor `ShotImageCandidatesDialog` to:
  - retain lazy candidate query and domain mutations;
  - render the reusable loading/error collection states and no Dialog for an
    empty result;
  - render the direct shared viewer for exactly one ready image;
  - render the reusable collection dialog for multiple ready images;
  - select the existing flush presentation so its Dialog chrome remains
    visually unchanged;
  - configure each candidate card with image-preview activation;
  - preserve one-way selection and unselected-only recoverable delete;
  - restore focus to the exact rail action on close.
- Preserve resource invalidation and visible rail/mosaic refresh.

### Slice 6: verify consistency and remove duplication

- Delete obsolete preview state and duplicate Dialog/grid anatomy from migrated
  features.
- Confirm no parallel image-preview activation or card-collection Dialog
  survives for an included MediaCard surface.
- Run the Product Design comparison loop against the locked baselines. Fix and
  recapture every P0/P1/P2 finding and every unexplained pixel difference,
  without redesigning card or Dialog geometry.

## Tests And Guardrails

### Shared MediaCard tests

Cover in `media-card.test.tsx`:

- callback activation invokes only the callback;
- image-preview activation opens the shared viewer;
- omitted activation renders no whole-card button;
- disabled callback and preview activation do nothing;
- selection, corner, and delete actions never invoke callback or preview;
- preview closes through close button, Escape, and backdrop;
- close returns focus to the exact card activation button;
- no nested buttons are rendered.

Cover in `media-card-collection-dialog.test.tsx`:

- stable loading, error/retry, empty, and ready states;
- ordered `MediaCardCollectionItem` rendering;
- exact flush and inset presentation selection;
- accepted minimum card width and gap;
- focus trap and close behavior;
- prepared callback, image-preview, selection, corner, and delete contracts
  retain their MediaCard isolation;
- no feature or domain contract is required.

Architecture guardrails protect the stable `ui -> features/services` import
boundary. Do not add source-text tests that inventory file, function, or private
helper names.

### Feature tests

Shot Plans component coverage proves:

- activating Shot 1 and Shot 2 rail cards changes only the selected Shot;
- the lower-right image action does not select the Shot;
- zero candidates expose no lower-right rail action and no candidate Dialog;
- one candidate opens only the large viewer with no choose control;
- multiple candidates open the collection dialog;
- candidate-card activation opens the large viewer and does not select;
- the lower-right choose control selects and does not preview;
- closing a nested preview returns to its card and keeps the collection open;
- closing the direct viewer or collection returns to the exact rail action;
- selected status, unselected delete, refresh, retry, and mutation failure
  remain correct.

Reference Picker coverage proves that the same collection dialog supports
container-owned callback choice with image preview disabled.

Representative gallery coverage proves Cast, Location, Lookbook, and
Inspiration cards use semantic preview activation without duplicating local
viewer state.

### Locked visual regression coverage

Extend the package-owned Playwright compatibility/regression coverage from
pre-refactor baselines rather than approving screenshots generated after the
refactor:

- compare Shot rail wide and compact states with identical selected Shot,
  project data, fonts, viewport, density, animations disabled, and caret hidden;
- compare every Shot candidate state while preserving the existing Dialog
  frame, header, body padding, grid width, cards, copy, and controls;
- compare Reference Picker before and after with its inset frame and 16:10 cards;
- compare Cast, Location, Lookbook, and Inspiration galleries and their open
  large-viewer states;
- assert the new one-image direct viewer and multi-image nested preview through
  roles and accessible names in addition to screenshot evidence;
- keep masks limited to exact dynamic image pixels and identifiers; no broad
  component masks, raised thresholds, snapshot regeneration, or skipped states
  may hide a visual difference.

Unchanged states must have no unexplained pixel difference. For the new Shot
states, compare the unchanged surrounding rail/Dialog/viewer chrome against the
current source and limit accepted differences to the requested interaction
region.

### Desktop journey

Use an isolated working copy of
`$HOME/renku-movies/urban-basilica` or deterministic Studio fixtures to verify:

1. a Shot Plan with at least two Shots remains navigable from the rail;
2. a zero-image Shot keeps its placeholder rail card free of an image action
   and opens no Dialog;
3. a one-image Shot opens the large viewer directly;
4. a multi-image Shot opens the collection, previews a card, selects a
   different card, and refreshes the rail;
5. keyboard activation, Escape, close controls, and focus return work at every
   layer;
6. 1440×900 and 1024×900 desktop layouts preserve current rail, card, and
   Dialog geometry;
7. browser warning/error logs remain empty.

### Product Design QA

Before handoff, run the Product Design comparison workflow rather than judging
from code or screenshots viewed separately:

1. pair each accepted source capture with its post-refactor capture at the same
   viewport, state, theme, project data, crop, and pixel density;
2. put each source/implementation pair into one comparison input;
3. inspect full views and focused crops for typography, spacing/layout rhythm,
   colors/tokens, image quality, icons, copy, borders, radii, shadows, hover,
   focus, selected, loading, error, and open-Dialog states;
4. classify differences and block on every P0/P1/P2 finding or unexplained
   visual change;
5. fix, recapture, and compare again after every blocking finding;
6. update project-root `design-qa.md` with source and implementation paths,
   dimensions, viewport, state, full/focused evidence, comparison history, and
   `final result: passed`.

The QA report must name the accepted Shot interaction constraints
separately from internal-refactor comparisons. It may not mark the refactor
passed by treating a visual regression as a design improvement.

## Documentation

- Add `docs/decisions/0066-use-semantic-media-card-preview-and-collection-dialogs.md`.
- Add a narrow Decision 0066 notice to Decision 0053.
- Update `docs/product/design-guidelines.md` with the new activation union,
  collection Dialog, and Shot rail/candidate behavior.
- Update `docs/architecture/reference/front-end-guidelines.md`.
- Update the project-root `design-qa.md` during implementation with the locked
  internal-refactor comparisons plus same-state Shot rail, one-image viewer,
  and multi-image collection evidence.
- No Studio Skills change is required because this is browser presentation
  behavior and does not change CLI or agent contracts.

## Final Verification

Run:

```bash
pnpm --dir packages/studio exec vitest run \
  src/ui/media-card/media-card.test.tsx \
  src/ui/media-card/media-card-collection-dialog.test.tsx \
  src/features/reference-picker/reference-picker-dialog.test.tsx \
  src/features/movie-studio/shot-plans/shot-plans.test.tsx
pnpm --dir packages/studio exec playwright test \
  --project=chromium-compatibility
pnpm --filter @gorenku/studio test:typecheck
pnpm build
pnpm test
pnpm lint
pnpm check
```

Then:

- inspect `git diff --check`, `git diff --stat`, and the complete diff;
- inspect every new or heavily modified MediaCard file;
- confirm `media-card.tsx` remains shallow;
- confirm no new `index.ts` or re-export facade exists;
- confirm the old untagged activation contract is removed rather than
  preserved;
- confirm no feature-owned duplicate collection Dialog remains for Shot
  candidates or Reference Picker;
- confirm no MediaCard image-gallery caller retains duplicate preview state;
- compare every locked same-state visual baseline without regenerating it;
- run the Product Design side-by-side comparison loop and confirm the five
  required fidelity surfaces have no unexplained regression;
- confirm no checklist item was satisfied by accepting a god file, generic
  modal framework, or domain branching in `src/ui`;
- capture and compare the required desktop states and record
  `final result: passed` in `design-qa.md`; any remaining P0/P1/P2 finding,
  unexplained pixel difference, or missing source/implementation pair blocks
  completion.

## Completion Result

Implementation, contract migrations, Decision 0066, current documentation,
focused tests, deterministic browser coverage, and Product Design QA are
complete.

Verification results:

- after product review, image-less Shot placeholders expose no lower-right
  image action or candidate Dialog; the obsolete empty-Dialog regression image
  and comparison composite were removed;
- the focused MediaCard, collection Dialog, Reference Picker, and Shot Plan
  suite passes 43 tests;
- representative gallery and capability-based architecture coverage passes;
- the Plan-owned Playwright compatibility suite passes all three tests with
  unmasked, deterministic locked screenshots;
- Studio test typecheck passes;
- root build, test, lint, and check pass; lint retains the existing
  `server/bin.ts` console warning and reports no errors;
- `design-qa.md` records same-input full and focused comparisons with
  `final result: passed`;
- `git diff --check` passes, and the complete diff plus new and heavily
  modified files were inspected for architecture and formatting shape.

The full compatibility command also runs the older
`studio-ui.compat.spec.ts`. That pre-existing suite still reports the same
101-pixel text-antialiasing drift around the `SHOT PLANS` tab in
`scene-narrative.png` that was reproduced before implementation. Its snapshot,
threshold, and test remain unchanged. All Plan 0160 locked surfaces pass exact
comparison, so this explained pre-existing baseline drift is not an
implementation regression or missing comparison.

## Completion Checklist

### Review Area

- [x] Confirm every implementation concept traces to the requirement ledger.
- [x] Confirm the rail card remains a Shot selector and never opens a viewer.
- [x] Confirm the lower-right rail action owns the exact Shot-image flow.
- [x] Confirm shared ownership is visually internal everywhere outside the
      explicitly requested Shot interaction changes.
- [x] Confirm accepted Plan 0157 sources and current production captures were
      used as design truth rather than approximated from prose.
- [x] Confirm the implementation preserves Core, service, and UI ownership
      boundaries.
- [x] Confirm centralized MediaCard ownership did not become a monolithic
      implementation.
- [x] Confirm the final module shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, generic modal framework, catch-all helper,
      or god file was added.

### Architecture And Contracts

- [x] Add the exact callback/image-preview `MediaCardActivation` union.
- [x] Add the exact bounded `MediaCardCollectionItem` and Dialog-state
      contracts.
- [x] Add the bounded flush/inset collection presentation without class-name or
      arbitrary-layout escape hatches.
- [x] Keep domain types, fetching, mutations, ordering, and copy out of
      `src/ui`.
- [x] Keep canonical Shot selection behind the existing focused Core command.
- [x] Update every activation caller directly; add no compatibility shape.
- [x] Reuse the existing shared viewer without a second implementation or
      pass-through wrapper.
- [x] Add Decision 0066 and only a narrow discoverability notice to Decision
      0053.

### Shared MediaCard Implementation

- [x] Add `media-card-activation.tsx` with callback and image-preview behavior.
- [x] Keep `media-card.tsx` as shallow composition.
- [x] Compose the existing shared large image viewer.
- [x] Add `MediaCardCollectionDialog` with bounded Dialog and grid anatomy.
- [x] Preserve exact current flush Shot and inset Reference Picker frames.
- [x] Cover loading, error/retry, empty, and ready collection states.
- [x] Reuse `MediaCardCollectionItem` from `MediaCollectionSection`.
- [x] Preserve action z-order and event isolation.
- [x] Preserve close, Escape, backdrop, focus trap, and exact-trigger focus
      return.
- [x] Preserve MediaCard and ImagePreviewDialog DOM/CSS presentation outside
      the behavior required for preview ownership.

### Feature Containers

- [x] Keep Shot rail activation callback-only for Shot selection.
- [x] Keep its bottom-right action separate from rail-card activation.
- [x] Keep Shot candidate loading and mutations in the Shot Plan feature.
- [x] Omit the lower-right rail action and candidate Dialog for zero image
      candidates.
- [x] Route one candidate to the direct large viewer without selection or
      implicit mutation.
- [x] Route multiple candidates to the shared collection Dialog.
- [x] Enable candidate-card preview and lower-right one-way choose as separate
      controls.
- [x] Preserve selected status, unselected-only Trash, retry, mutation errors,
      and resource refresh.
- [x] Refactor Reference Picker to the shared collection Dialog with preview
      disabled, callback choice retained, and no visible change.
- [x] Migrate current MediaCard image galleries to semantic preview activation.
- [x] Preserve the current cards, grid, copy, spacing, image treatment, action
      placement, and viewer presentation in every migrated gallery.
- [x] Leave non-card pure presentation images outside MediaCard chrome.

### Tests And Guardrails

- [x] Add complete shared activation behavior tests.
- [x] Add complete shared collection Dialog state and interaction tests.
- [x] Add Shot no-action/one/multiple candidate behavior tests.
- [x] Prove rail-card selection remains available across multiple Shots.
- [x] Prove candidate preview, choose, corner, and delete actions are isolated.
- [x] Prove direct and nested preview focus return.
- [x] Add representative Reference Picker and gallery migration tests.
- [x] Lock pre-refactor Playwright baselines before implementation changes.
- [x] Add same-state visual coverage for every modified surface and both
      collection presentations.
- [x] Keep masks narrowly limited and do not regenerate baselines to accept
      refactor drift.
- [x] Keep import-boundary architecture guardrails capability-based rather than
      naming private implementation symbols.

### Documentation

- [x] Add Decision 0066 and update current MediaCard documentation.
- [x] Preserve Decision 0053's historical body.
- [x] Update current product and frontend guidance.
- [x] Record source/implementation pairs, full and focused comparisons,
      dimensions, state, findings, iteration history, and final result in
      `design-qa.md`.
- [x] Do not edit historical plans for a naming sweep.

### Final Verification

- [x] Run focused MediaCard, collection Dialog, Reference Picker, and Shot Plan
      tests.
- [x] Run locked Playwright compatibility/regression screenshots.
- [x] Run Studio test typecheck.
- [x] Run root build, test, lint, and check.
- [x] Verify the multi-Shot rail and no-action/one/multiple image journeys.
- [x] Verify 1440×900 and 1024×900 desktop states and clean browser logs.
- [x] Run Product Design QA with each source and implementation capture
      compared together at the same state and viewport.
- [x] Confirm typography, spacing, colors, imagery, copy, and interaction
      states did not regress.
- [x] Block completion on any remaining P0/P1/P2 finding, unexplained visual
      difference, or missing comparison evidence.
- [x] Inspect `git diff --check`, `git diff --stat`, and the complete diff.
- [x] Inspect new and heavily modified files for architecture shape.
- [x] Confirm `media-card.tsx` remains shallow and no `index.ts` was added.
- [x] Confirm no duplicate feature-owned preview or collection implementation
      survives.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
