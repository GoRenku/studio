# 0046 Shot Video Inline Reference Tabs

Status: proposed
Date: 2026-06-04

## Summary

The shot detail surface should stop using a separate `Preview Take Plan` dialog
for shot-video planning. The plan information belongs inline in the existing
shot tabs, where the user is already choosing the shot's visual references and
AI Production settings.

This plan changes the shot detail surface to:

- show the final video prompt at the top of Run Setup;
- remove the `Preview Take Plan` button and dialog;
- add dedicated Cast, Lookbook, and References tabs;
- simplify Location so it directly selects one project location and one
  environment-sheet view;
- keep reference cards quiet, image-led, and cost-aware;
- open sheet images through the reusable `ImagePreviewDialog`;
- move reference selection, defaulting, asset resolution, and cost projection
  into core-owned server responses instead of Studio browser logic.

The dependency graph from plans `0042` and `0045` remains the source of truth
for reference availability and cost. Studio renders a core-provided projection
of that graph. Studio must not infer which references are needed, which assets
exist, or how much a missing reference costs.

## Relationship To Existing Plans

This plan updates the Studio surface described in:

- `plans/active/0038-shot-composition-location-tabs.md`
- `plans/active/0039-shot-ai-production-tab.md`
- `plans/active/0041-shot-ai-production-studio-ui.md`
- `plans/active/0042-shot-video-take-generation-plan-architecture.md`
- `plans/active/0045-shot-video-reference-dependency-graph-estimates.md`

It does not replace the dependency-graph architecture. It replaces the current
browser presentation of that graph.

The following older UI decisions are superseded for the Studio browser:

- the AI Production tab no longer has a `Preview Take Plan` action;
- `SceneShotVideoTakePreflightDialog` is removed;
- the dialog-specific input card projection is removed or renamed into the
  inline core projection described here;
- the old Location `usesDifferentLocation` and `customView` fields are removed
  from the current shot specs contract.

There is no compatibility period. Callers should be updated directly.

## Current Problems

### The Dialog Duplicates The Tab

The current `Preview Take Plan` dialog repeats:

- model choice;
- run parameters;
- estimated total;
- reference cards;
- final prompt state.

That makes the UI harder to reason about because the user sees two surfaces that
claim to describe the same run.

### The Dialog Still Misses Real Inputs

The current dialog is graph-backed after plan `0045`, but its shape is still
dialog-first. It can show cast, location, and lookbook reference cards, but
those references are not editable where the user naturally thinks about them.

Example:

- A shot's cast references should be edited in a Cast tab.
- A shot's location reference should be edited in the Location tab.
- A shot's lookbook sheet should be edited in a Lookbook tab.
- First frame, last frame, and custom image references should be edited in a
  References tab.

The dialog forces all of those into one late review step.

### Location Has Obsolete State

The current Location tab has:

- a `Different Location` toggle;
- `usesDifferentLocation`;
- a `Custom View` textarea;
- `customView`.

That is awkward for the current product direction. The user should simply pick
one project location from the full project location list. If the selected
location has environment-sheet views, the user can choose one of those views.
If the sheet is missing, the card should show the planned generation estimate.

### Studio Browser Is Doing Too Much Reference Work

The current Location tab fetches location assets directly and builds a local
projection for environment-sheet views. That was acceptable for the first shot
specs slice, but the new reference tabs need graph pricing, default reference
selection, selected asset resolution, and missing-reference planning.

Those rules belong in core and are exposed through Studio server APIs. The
browser should render the returned choices and send explicit mutations.

## Goals

1. Move the take-plan review into the existing tabs.
2. Make reference selection editable in the tab that owns the reference type.
3. Keep every card tied to a core dependency graph node, existing asset, or
   explicit reference option.
4. Show generation cost estimates on cards when the image reference is not yet
   available.
5. Use the reusable `ImagePreviewDialog` whenever a reference card has a real
   image asset.
6. Remove the obsolete dialog, button, fallback estimate branches, and Location
   fields in the same implementation slice.
7. Keep all controls on local shadcn-style primitives from `packages/studio/src/ui`.
8. Keep Studio browser components thin: no provider capability inference, no
   asset selection rules, no pricing logic, and no hidden fallbacks.

## Non-Goals

This plan does not:

- add paid generation from Studio;
- design the future AI Agent custom-reference creation flow;
- add cast audio assets yet;
- add narrator audio assets yet;
- add profile images to the shot Cast tab;
- add mobile behavior;
- preserve the old preflight dialog as a hidden or alternate surface;
- keep `usesDifferentLocation` or `customView` as accepted shot specs fields;
- add UI-only placeholder prices;
- add wrapper components whose purpose is only to preserve old component names
  or old API responses.

## Product Decisions

### Final Tab Order

The shot detail tab list becomes:

```text
Description
Lookbook
Composition
Motion
Cast
Location
References
AI Production
```

Rules:

- `Camera Motion` is renamed to `Motion`.
- `Lookbook` sits between `Description` and `Composition`.
- `Cast` sits between `Motion` and `Location`.
- `References` sits immediately before `AI Production`.
- `AI Production` remains the final tab.

### Inline AI Production

The AI Production tab keeps:

- Intent;
- Model;
- Run Setup.

Run Setup changes:

- the final prompt appears at the top of Run Setup;
- route-specific controls stay below the prompt;
- the estimated total stays in the footer;
- there is no `Preview Take Plan` button;
- there is no preflight dialog mounted from this tab.

If no final prompt exists, core returns `finalPrompt: null`. The UI may show the
current terse empty state, such as `No prompt drafted yet.`, because that is a
real product state, not filler text.

### Cast Tab

The Cast tab owns cast reference selection for the selected shot or shot group.

Rules:

- the top of the tab lists cast members by meaningful names;
- members present in the shot are selected by default;
- the user can add or remove cast references by clicking cast member controls in
  that list;
- selected cast references render character-sheet cards;
- only character sheets appear in this tab;
- profile images, exploration images, and other cast assets do not appear;
- there is no `Custom Cast Member` text button or similar free-text control;
- missing character sheets show their graph-backed generation estimate on the
  card;
- existing character sheet images open in `ImagePreviewDialog`.

Future audio work:

- cast audio references and narrator audio references will later appear in this
  tab;
- the current implementation must not make the Cast tab image-only at the core
  contract level;
- the current UI slice only renders character-sheet image cards.

### Location Tab

The Location tab owns one selected shot location.

Rules:

- all project locations are listed;
- the default selected location comes from the shot context;
- the user selects exactly one location;
- there is no `Different Location` toggle;
- there is no `Custom View` textarea;
- the selected location's environment-sheet views are shown as cards;
- the user can select exactly one environment-sheet view;
- missing environment sheets show a graph-backed generation estimate;
- existing environment-sheet view images open in `ImagePreviewDialog`.

The persistent shot specs contract keeps `locationId` and `azimuthView`.
`usesDifferentLocation` and `customView` are deleted.

### Lookbook Tab

The Lookbook tab owns one selected Lookbook sheet reference.

Rules:

- the tab has one clean section listing available sheets from the active
  Lookbook;
- all available Lookbook sheet images are shown;
- the user can choose one sheet at a time;
- the default selected sheet is core-selected from the active Lookbook;
- missing active Lookbook imagery shows the graph-backed `lookbook.image`
  estimate on a card;
- existing Lookbook images open in `ImagePreviewDialog`;
- no raw filenames, raw asset ids, raw image ids, or generated role names appear
  on the cards.

### References Tab

The References tab owns other image references used by video generation.

Initial reference types:

- first frame;
- last frame;
- shot reference sheet;
- custom reference images that already exist.

Rules:

- the tab has one clean card section;
- each reference card comes from the core plan projection;
- existing image references open in `ImagePreviewDialog`;
- missing generated references show their graph-backed estimate;
- custom references are displayed when they exist;
- do not add an unbacked custom-reference text button or upload placeholder in
  this slice.

The future AI Agent custom-reference flow can add custom references through a
core command. Once that command exists, this tab can expose an add action that
calls that command. Until then, the tab only displays existing custom
references and graph-planned generated references.

### Image Preview Behavior

Cast, Location, Lookbook, and References cards share this behavior:

- if the card has one or more real image URLs, clicking the image opens
  `ImagePreviewDialog`;
- if the card represents a missing planned generation, the card is not a fake
  preview target;
- if a sheet has multiple view images, the preview dialog receives the full
  ordered image list and opens at the clicked image;
- cards must use local shadcn `Button` for interactive image areas.

## Core Contracts

### Shot Specs

Update `packages/core/src/client/scene-shot-list.ts`.

Remove obsolete Location fields:

```ts
export interface ShotLocationSpecs {
  locationId?: string;
  azimuthView?: LocationAzimuthViewId;
}
```

Add explicit reference specs:

```ts
export interface ShotCastReferenceSpecs {
  castMemberIds?: string[];
}

export interface ShotLookbookReferenceSpecs {
  lookbookImageId?: string;
}

export interface ShotReferenceImageSpecs {
  customReferenceInputIds?: string[];
}

export interface ShotSpecs {
  shotSize?: ShotSizeId;
  subjectFraming?: SubjectFramingId[];
  cameraAngle?: CameraAngleId;
  dutch?: 'left' | 'right';
  movement?: ShotMovementSpecs;
  lens?: ShotLensSpecs;
  location?: ShotLocationSpecs;
  castReferences?: ShotCastReferenceSpecs;
  lookbookReference?: ShotLookbookReferenceSpecs;
  referenceImages?: ShotReferenceImageSpecs;
  custom?: ShotCustomSpecs;
}
```

Defaulting rules:

- `castReferences.castMemberIds` absent means use `SceneShot.castMemberIds`;
- `castReferences.castMemberIds: []` means the user removed all cast
  references for this shot;
- `location.locationId` absent means use the first core-selected shot location;
- `lookbookReference.lookbookImageId` absent means use the core-selected default
  active Lookbook image;
- `referenceImages.customReferenceInputIds` absent means no explicit custom
  image references beyond graph-derived route inputs.

The JSON schema and semantic validator must reject malformed values. Do not add
loader branches for `usesDifferentLocation` or `customView`.

### Inline Production Plan Report

Add a browser-safe core contract that is returned through the Studio server.

Proposed public name:

```ts
export interface ShotVideoTakeProductionPlanReport {
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  finalPrompt: ShotVideoTakePromptDraft | null;
  plan: ShotVideoTakeGenerationPlan;
  castReferences: ShotVideoTakeCastReferenceChoice[];
  locationReferences: ShotVideoTakeLocationReferenceChoice[];
  lookbookReferences: ShotVideoTakeLookbookReferenceChoice[];
  imageReferences: ShotVideoTakeImageReferenceChoice[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}
```

Reference choice contracts:

```ts
export type ShotVideoTakeReferenceChoiceState =
  | 'selected-ready'
  | 'selected-planned'
  | 'available'
  | 'not-selected'
  | 'unavailable';

export interface ShotVideoTakeReferenceImagePreview {
  src: string;
  alt: string;
  title: string;
  assetId: string;
  assetFileId: string;
}

export interface ShotVideoTakeReferenceCardPlan {
  state: ShotVideoTakeReferenceChoiceState;
  mediaKind: MediaKind;
  dependencyId?: string;
  dependencyNodeId?: string;
  planLineId?: string;
  purpose?: MediaGenerationPurpose | null;
  pricing: MediaGenerationDependencyPricing;
  previews: ShotVideoTakeReferenceImagePreview[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface ShotVideoTakeCastReferenceChoice {
  castMemberId: string;
  name: string;
  selected: boolean;
  defaultSelected: boolean;
  characterSheet: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeLocationReferenceChoice {
  locationId: string;
  name: string;
  selected: boolean;
  defaultSelected: boolean;
  environmentSheet: ShotVideoTakeReferenceCardPlan;
  viewChoices: ShotVideoTakeLocationViewChoice[];
}

export interface ShotVideoTakeLocationViewChoice {
  viewId: LocationAzimuthViewId;
  label: string;
  selected: boolean;
  preview: ShotVideoTakeReferenceImagePreview | null;
}

export interface ShotVideoTakeLookbookReferenceChoice {
  lookbookImageId: string | null;
  lookbookId: string;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  image: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeImageReferenceChoice {
  referenceKind:
    | 'first-frame'
    | 'last-frame'
    | 'shot-reference-sheet'
    | 'custom-reference-image';
  title: string;
  selected: boolean;
  image: ShotVideoTakeReferenceCardPlan;
}
```

Core projection rules:

- every selected reference card maps to a dependency graph node, an existing
  selected input, or an explicit structured diagnostic;
- planned generations use `MediaGenerationDependencyPricing` from the graph;
- existing assets use `pricing: { state: 'priced', estimatedUsd: 0 }`;
- missing manual attachments use `pricing.state: 'not-applicable'`;
- unpriced planned generations use `pricing.state: 'unpriced'`;
- Studio does not build these states from `assetId`, `purpose`, or route
  fields.

### Reference Selection Mutations

Reference selection changes must go through core-owned server APIs.

Use the existing shot specs persistence path for shot-level specs, but add
focused core methods and request readers so feature components do not construct
new shot specs objects by hand for multi-field reference changes.

Required core service methods:

```ts
updateSceneShotCastReferences(input)
updateSceneShotLocationReference(input)
updateSceneShotLookbookReference(input)
updateSceneShotCustomReferenceImages(input)
```

Each method:

- opens the current project session;
- validates the scene, active shot list, shot id, and referenced ids;
- updates the current `SceneShot.shotSpecs`;
- returns the refreshed core `SceneShotListResource` and scoped resource keys;
- reports structured diagnostics for unknown cast members, locations, Lookbook
  images, or shot-video input ids.

Do not let the browser decide whether a clicked id is valid.

### Reference Bundle Resolution

Update shot-video dependency planning so it reads the current shot reference
specs.

Rules:

- cast reference slots come from `shotSpecs.castReferences.castMemberIds` when
  present, otherwise from `SceneShot.castMemberIds`;
- location reference slots come from `shotSpecs.location.locationId` when
  present, otherwise from the core-selected shot location default;
- Lookbook reference slots come from
  `shotSpecs.lookbookReference.lookbookImageId` when present, otherwise from the
  core-selected active Lookbook image;
- custom image references come from
  `shotSpecs.referenceImages.customReferenceInputIds`;
- first-frame, last-frame, and shot-reference-sheet slots still come from the
  selected model route, intent, and requested inputs.

If a stored reference id points at a missing domain object or missing input,
planning fails with structured diagnostics. Do not silently fall back to the old
shot defaults.

## Studio Server APIs

Update the Studio server so the browser can read one inline report for the
current production group:

```text
POST /screenplay/scenes/:sceneId/video-take-production/plan
```

Request:

```ts
{
  productionGroup: ShotVideoTakeProductionGroup;
  inputPolicy?: ShotVideoTakeInputPolicy;
}
```

Response:

```ts
{
  report: ShotVideoTakeProductionPlanReport;
}
```

If the current `/plan` endpoint already exists with a raw `{ plan }` response,
update callers directly to the new `{ report }` response. Do not keep both
response shapes.

Add focused mutation routes:

```text
PATCH /screenplay/scenes/:sceneId/shots/:shotId/cast-references
PATCH /screenplay/scenes/:sceneId/shots/:shotId/location-reference
PATCH /screenplay/scenes/:sceneId/shots/:shotId/lookbook-reference
PATCH /screenplay/scenes/:sceneId/shots/:shotId/custom-reference-images
```

Each route:

- accepts exactly one request shape;
- rejects unknown top-level fields;
- delegates deep validation to core;
- returns the refreshed shot-list resource and resource keys;
- serializes structured diagnostics through the existing Studio API error path.

## Studio Browser Implementation

### Service Layer

Update `packages/studio/src/services/studio-shot-video-takes-api.ts`.

Required service functions:

```ts
readShotVideoTakeProductionPlan(...)
updateSceneShotCastReferences(...)
updateSceneShotLocationReference(...)
updateSceneShotLookbookReference(...)
updateSceneShotCustomReferenceImages(...)
```

Remove or rename browser functions whose only purpose is opening the old dialog:

- `previewShotVideoTakeProduction` if no non-dialog caller remains;
- `planShotVideoTakeProduction` raw-plan response if replaced by
  `readShotVideoTakeProductionPlan`;
- dialog-only input picker response shaping if no inline tab uses it.

Do not keep old service names as aliases.

### Hook Layer

Update `use-shot-video-take-production.ts`.

The hook should own:

- loading context and model reports;
- autosaving production group settings;
- reading the inline `ShotVideoTakeProductionPlanReport`;
- exposing `finalPrompt`;
- exposing graph-backed reference choices;
- refreshing the report after cast, location, Lookbook, custom reference,
  reusable-input, or parameter changes.

Remove:

- `previewOpenRef`;
- `previewState` if it only represented dialog loading;
- `runPreview` if it only opened the dialog;
- any state that keeps a stale dialog report alive after the tab changes.

Estimate display must read `report.plan.estimate`. Delete fallback to
`estimate.estimatedCostUsd` when a graph-backed plan is available.

### Scene Shot Detail

Update `scene-shot-detail.tsx`.

Required changes:

- tab order matches the Product Decisions section;
- `camera-motion` label becomes `Motion`;
- add `SceneShotLookbookTab`;
- add `SceneShotCastTab`;
- add `SceneShotReferencesTab`;
- keep `SceneShotAiProductionTab` last;
- keep the existing shot video stage and resizable layout.

### Shared Reference Card Treatment

Create feature-local card components only where they remove real duplication.

Proposed files:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card-grid.tsx
```

These are not compatibility wrappers. They own the repeated visual treatment
for shot reference cards in Cast, Location, Lookbook, and References.

Rules:

- use local shadcn `Button` for clickable images;
- use local `Badge` or existing token styling for compact selected/needed
  states only if the state is useful;
- show a cost when `pricing.state === 'priced'` and the card has no preview
  image;
- show `Unpriced` for unpriced planned generations;
- show no fake image;
- use `ImageOff` or the current quiet missing-image treatment for unavailable
  images;
- do not show raw ids, filenames, or provider names.

### Cast Tab Component

Add:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-cast-tab.tsx
```

Responsibilities:

- render cast member selection controls from
  `ShotVideoTakeCastReferenceChoice[]`;
- call `updateSceneShotCastReferences` with the selected cast member ids;
- render selected character-sheet cards;
- open `ImagePreviewDialog` for existing character-sheet images;
- render card estimates for missing character sheets.

The component must not:

- read cast assets directly;
- infer character-sheet role names;
- render profile assets;
- mutate shot specs locally without a core API call.

### Location Tab Component

Update:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-location-tab.tsx
```

Responsibilities:

- render all project locations from the core report;
- call `updateSceneShotLocationReference` when the selected location changes;
- render environment-sheet view cards for the selected location;
- call `updateSceneShotLocationReference` when the selected view changes;
- open `ImagePreviewDialog` for existing environment-sheet view images;
- show graph-backed cost for missing environment sheets.

Remove:

- `Switch` usage for `Different Location`;
- `usesDifferentLocation`;
- `CustomFieldRow` usage for location;
- `customView`;
- direct `readLocationAssets` calls from this shot tab if the core report
  replaces them.

### Lookbook Tab Component

Add:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-lookbook-tab.tsx
```

Responsibilities:

- render active Lookbook image choices from the core report;
- call `updateSceneShotLookbookReference` with one selected Lookbook image id;
- render one clean card grid;
- open `ImagePreviewDialog` for existing Lookbook images;
- show graph-backed cost when the active Lookbook needs an image generated.

The component must not:

- fetch the whole Lookbook resource and infer suitable images itself;
- sort Lookbook images by raw filenames;
- show raw Lookbook image ids or asset ids.

### References Tab Component

Add:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx
```

Responsibilities:

- render first-frame, last-frame, shot-reference-sheet, and custom-reference
  image cards from `ShotVideoTakeImageReferenceChoice[]`;
- open `ImagePreviewDialog` for existing images;
- show planned generation estimates for missing generated references;
- call existing reusable-input selection APIs only when the card exposes valid
  core-provided candidates.

The component must not:

- add a fake `Custom reference` card when none exists;
- expose an unimplemented add button;
- infer route-required first/last frame references from model labels.

### AI Production Tab Component

Update:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-run-setup.tsx
```

Required changes:

- remove `SceneShotVideoTakePreflightDialog` import and mount;
- remove `previewOpen` state;
- remove `handleOpenPreview`;
- pass `finalPrompt` into Run Setup;
- render the final prompt above parameter controls;
- remove the `Preview Take Plan` button from the footer;
- display estimate from the graph-backed inline report;
- keep autosave status visible.

If the report is loading, the estimate can show the existing loading state. Do
not open a modal.

### Mandatory Deletions

Delete obsolete files if no current caller remains:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-video-take-preflight-dialog.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-input-picker.tsx
```

Delete obsolete UI branches:

- `Preview Take Plan` button rendering;
- dialog open/close state;
- final-video-only estimate fallback in `displayEstimateTotal`;
- preflight-dialog tests;
- Location `Different Location` section;
- Location `Custom View` section.

After implementation, `rg "Preview Take Plan"` should return only historical
plan documents unless a current user-facing copy decision explicitly keeps the
phrase elsewhere. It should not appear in feature code.

## Core Implementation Notes

### Projection Builder

Add a core projection module:

```text
packages/core/src/server/media-generation/shot-video-take-production-plan-report.ts
```

Responsibilities:

- call the existing graph-backed shot-video planner;
- read shot reference specs;
- derive cast, location, Lookbook, and image reference choices;
- attach preview image URLs or preview descriptors through server-safe fields;
- attach graph pricing to missing references;
- return `ShotVideoTakeProductionPlanReport`.

This module must not build provider payloads. It reads the plan and projects it
for Studio.

### Asset Resolution

Core owns:

- selected character-sheet asset resolution;
- selected location environment-sheet composite and view resolution;
- Lookbook image file resolution;
- selected shot-video input resolution;
- missing asset-file diagnostics;
- ambiguous selected asset diagnostics;
- per-card graph pricing.

Studio owns:

- rendering the returned cards;
- opening preview images;
- sending explicit selection updates.

### Structured Diagnostics

Use structured diagnostics for package-boundary failures.

Proposed codes:

- `CORE_SHOT_REFERENCE_UNKNOWN_CAST_MEMBER`
- `CORE_SHOT_REFERENCE_UNKNOWN_LOCATION`
- `CORE_SHOT_REFERENCE_UNKNOWN_LOOKBOOK_IMAGE`
- `CORE_SHOT_REFERENCE_UNKNOWN_INPUT`
- `CORE_SHOT_REFERENCE_MISSING_ASSET_FILE`
- `CORE_SHOT_REFERENCE_AMBIGUOUS_SELECTED_ASSET`
- `CORE_SHOT_REFERENCE_INVALID_SELECTION`
- `CORE_SHOT_REFERENCE_PLAN_UNAVAILABLE`

Do not add loose `throw new Error(...)` behavior in core or Studio server
boundary code.

## Test Plan

### Core Contract Tests

Add or update tests for:

- `ShotLocationSpecs` rejects `usesDifferentLocation`;
- `ShotLocationSpecs` rejects `customView`;
- `ShotCastReferenceSpecs` accepts explicit cast member id lists;
- `ShotCastReferenceSpecs` accepts an empty list as a real user override;
- `ShotLookbookReferenceSpecs` accepts one Lookbook image id;
- `ShotReferenceImageSpecs` accepts custom reference input ids;
- malformed reference ids produce structured diagnostics;
- unknown fields are not preserved as compatibility state.

### Core Plan Projection Tests

Add tests for `ShotVideoTakeProductionPlanReport`:

- default cast choices come from `SceneShot.castMemberIds`;
- explicit cast reference choices override the defaults;
- empty cast reference choices remove all cast references;
- default location comes from shot location context;
- explicit `shotSpecs.location.locationId` overrides default location;
- Location projection lists all project locations;
- Location projection is single-select;
- Lookbook projection lists active Lookbook images;
- Lookbook projection is single-select;
- first-frame and last-frame cards come from graph route inputs;
- custom reference image cards are shown when custom references exist;
- missing character sheet cards show the graph dependency estimate;
- missing location sheet cards show the graph dependency estimate;
- missing Lookbook image cards show the graph dependency estimate;
- existing references show `$0.00` pricing internally but do not need noisy
  visible `$0.00` copy unless the design calls for it;
- every selected reference card maps to a graph node, existing input, or
  structured diagnostic.

### Studio Server Tests

Add tests for:

- `/video-take-production/plan` returns
  `ShotVideoTakeProductionPlanReport`;
- `/video-take-production/plan` rejects unknown top-level fields;
- cast reference mutation rejects unknown top-level fields;
- location reference mutation rejects unknown top-level fields;
- Lookbook reference mutation rejects unknown top-level fields;
- custom reference mutation rejects unknown top-level fields;
- mutation routes delegate validation to core;
- mutation routes return refreshed shot-list resources and scoped resource keys;
- structured diagnostics serialize through the existing Studio API error path.

### Studio UI Tests

Add or update tests for:

- tab order is `Description`, `Lookbook`, `Composition`, `Motion`, `Cast`,
  `Location`, `References`, `AI Production`;
- `Camera Motion` no longer appears;
- `Preview Take Plan` no longer appears in feature code or rendered UI;
- Run Setup renders final prompt above route controls;
- Run Setup renders the graph-backed estimate;
- no preflight dialog opens from AI Production;
- Cast tab shows selected default cast names;
- clicking cast member controls updates cast reference selection through the
  service API;
- Cast tab shows only character-sheet cards;
- Cast tab opens `ImagePreviewDialog` for existing character sheets;
- Cast tab shows card estimate for missing character sheets;
- Location tab has no `Different Location` switch;
- Location tab has no `Custom View` textarea;
- Location tab lists all project locations;
- Location tab allows one selected location;
- Location environment-sheet images open `ImagePreviewDialog`;
- Location tab shows card estimate for a missing environment sheet;
- Lookbook tab renders one clean sheet section;
- Lookbook tab allows one selected Lookbook sheet;
- Lookbook images open `ImagePreviewDialog`;
- Lookbook tab shows card estimate for a missing Lookbook image;
- References tab shows first frame and last frame cards when the graph requires
  them;
- References tab shows existing custom reference images when core returns them;
- References tab does not show an unimplemented add-custom-reference button;
- all interactive controls use local shadcn UI primitives.

### Static Cleanup Checks

Run focused static checks after implementation:

```bash
rg "usesDifferentLocation|customView" packages/core/src packages/studio/src
rg "Preview Take Plan|SceneShotVideoTakePreflightDialog" packages/studio/src
rg "<button|<input|<select|<textarea|<dialog" packages/studio/src/features/movie-studio/scenes
```

Expected result:

- no current code references `usesDifferentLocation` or `customView`;
- no current Studio feature code references the preflight dialog or button;
- no raw browser controls appear in feature code.

## Documentation

Update accepted documentation after implementation:

- `docs/architecture/media-generation.md`
  - describe inline shot-video production plan reports and graph-backed
    reference cards;
- `docs/architecture/reference/media-generation.md`
  - document how cast, location, Lookbook, first/last-frame, and custom
    references are resolved for `shot.video-take`;
- `docs/architecture/data-model-and-storage.md`
  - document the current shot reference specs fields if they remain part of the
    accepted model;
- `docs/architecture/reference/front-end-guidelines.md`
  - no broad rewrite needed, but update if this work introduces a reusable
    reference-card pattern that becomes a shared UI rule.

Do not edit old historical plans just to rename `Camera Motion` or remove
`Preview Take Plan`.

## Completion Checklist

### Review Area

- [ ] Confirm the new shot detail tab order.
- [ ] Confirm `Camera Motion` is renamed to `Motion`.
- [ ] Confirm `Preview Take Plan` is removed from current Studio UI.
- [ ] Confirm the reusable `ImagePreviewDialog` remains available for image
  enlargement.
- [ ] Confirm this plan does not add paid generation from Studio.
- [ ] Confirm this plan does not add an unbacked custom-reference button.
- [ ] Confirm there are no compatibility shims for old Location fields.
- [ ] Confirm there are no UI-only prices or UI-only dependency rules.

### Architecture And Contracts

- [ ] Remove `usesDifferentLocation` from `ShotLocationSpecs`.
- [ ] Remove `customView` from `ShotLocationSpecs`.
- [ ] Add `ShotCastReferenceSpecs`.
- [ ] Add `ShotLookbookReferenceSpecs`.
- [ ] Add `ShotReferenceImageSpecs`.
- [ ] Update `ShotSpecs` with the new reference specs.
- [ ] Update shot-list JSON schema for the new current fields.
- [ ] Update shot-list semantic validation for cast, location, Lookbook, and
  custom reference ids.
- [ ] Add `ShotVideoTakeProductionPlanReport`.
- [ ] Add `ShotVideoTakeReferenceCardPlan`.
- [ ] Add cast, location, Lookbook, and image reference choice contracts.
- [ ] Ensure reference choices expose graph pricing instead of separate card
  costs.
- [ ] Ensure existing assets are represented as ready references with real
  preview data.
- [ ] Ensure missing generated references are represented as planned references
  with graph-backed estimates.
- [ ] Ensure unpriced references are represented as unpriced, never `$0.00`.
- [ ] Ensure manual attachment references are represented as not applicable.

### Core Implementation

- [ ] Add the shot-video production plan report projection module.
- [ ] Derive default cast references from shot cast membership.
- [ ] Respect explicit empty cast reference selections.
- [ ] Derive default selected location from core shot context.
- [ ] Respect explicit shot location selection.
- [ ] List all project locations for the Location tab projection.
- [ ] Resolve selected location environment-sheet assets in core.
- [ ] Resolve selected location environment-sheet view images in core.
- [ ] Derive default active Lookbook sheet selection in core.
- [ ] Respect explicit Lookbook image selection.
- [ ] Resolve Lookbook image previews in core.
- [ ] Resolve first-frame, last-frame, shot-reference-sheet, and custom
  reference image choices from the dependency graph and shot-video inputs.
- [ ] Update reference bundle resolution to use shot reference specs.
- [ ] Add structured diagnostics for invalid or missing reference targets.
- [ ] Add focused core service methods for cast, location, Lookbook, and custom
  reference mutations.
- [ ] Return refreshed shot-list resources and scoped resource keys from each
  mutation.

### Studio Server

- [ ] Update `/video-take-production/plan` to return
  `ShotVideoTakeProductionPlanReport`.
- [ ] Update or remove raw-plan response callers directly.
- [ ] Add cast reference mutation route.
- [ ] Add location reference mutation route.
- [ ] Add Lookbook reference mutation route.
- [ ] Add custom reference images mutation route.
- [ ] Add strict request readers for each new route.
- [ ] Serialize structured diagnostics through the existing Studio API error
  path.

### Studio Services And Hooks

- [ ] Add `readShotVideoTakeProductionPlan`.
- [ ] Add `updateSceneShotCastReferences`.
- [ ] Add `updateSceneShotLocationReference`.
- [ ] Add `updateSceneShotLookbookReference`.
- [ ] Add `updateSceneShotCustomReferenceImages`.
- [ ] Remove dialog-only `previewShotVideoTakeProduction` usage if no current
  caller remains.
- [ ] Update `use-shot-video-take-production.ts` to read and refresh the inline
  plan report.
- [ ] Remove dialog open state from the hook and AI Production tab.
- [ ] Remove final-video-only estimate fallback once graph-backed report data is
  available.

### Studio UI

- [ ] Update `scene-shot-detail.tsx` tab order.
- [ ] Rename `SceneShotCameraMotionTab` display label to `Motion`.
- [ ] Add `SceneShotCastTab`.
- [ ] Add `SceneShotLookbookTab`.
- [ ] Add `SceneShotReferencesTab`.
- [ ] Update `SceneShotLocationTab`.
- [ ] Add feature-local shot reference card components if needed.
- [ ] Wire `ImagePreviewDialog` into Cast cards.
- [ ] Wire `ImagePreviewDialog` into Location cards.
- [ ] Wire `ImagePreviewDialog` into Lookbook cards.
- [ ] Wire `ImagePreviewDialog` into References cards.
- [ ] Show missing-reference estimates on cards.
- [ ] Keep cards quiet when no meaningful product text exists.
- [ ] Remove the `Different Location` section.
- [ ] Remove the `Custom View` section.
- [ ] Remove the `Preview Take Plan` button.
- [ ] Remove `SceneShotVideoTakePreflightDialog`.
- [ ] Delete obsolete dialog/input-picker files when no current caller remains.

### Tests

- [ ] Add core contract tests for removed Location fields.
- [ ] Add core contract tests for new reference specs.
- [ ] Add core projection tests for default and explicit cast references.
- [ ] Add core projection tests for default and explicit location references.
- [ ] Add core projection tests for default and explicit Lookbook references.
- [ ] Add core projection tests for first-frame and last-frame references.
- [ ] Add core projection tests for custom references.
- [ ] Add core projection tests for card pricing states.
- [ ] Add server route tests for the inline plan report.
- [ ] Add server route tests for each reference mutation.
- [ ] Update Studio tab-order tests.
- [ ] Update Studio AI Production tests for inline prompt and no dialog.
- [ ] Add Studio Cast tab tests.
- [ ] Add Studio Location cleanup tests.
- [ ] Add Studio Lookbook tab tests.
- [ ] Add Studio References tab tests.
- [ ] Add image preview dialog interaction tests for reference cards.
- [ ] Add shadcn-control/static tests for feature code if existing coverage does
  not already catch raw controls.

### Documentation

- [ ] Update `docs/architecture/media-generation.md`.
- [ ] Update `docs/architecture/reference/media-generation.md`.
- [ ] Update `docs/architecture/data-model-and-storage.md` if new shot specs
  fields are accepted.
- [ ] Update frontend reference docs only if a durable shared reference-card
  pattern is introduced.

### Final Verification

- [ ] Run `pnpm --dir packages/core test`.
- [ ] Run `pnpm --dir packages/studio test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm check`.
- [ ] Verify the Urban Basilica scene on desktop at
  `/projects/urban-basilica/scenes/scene_djkfgf9p`.
- [ ] Verify Cast, Location, Lookbook, References, and AI Production render
  without overlapping text.
- [ ] Verify missing cast/location/lookbook references show card estimates.
- [ ] Verify existing sheet images open `ImagePreviewDialog`.
- [ ] Verify no current Studio feature code references the deleted preflight
  dialog.
- [ ] Document any checks not run and why.
