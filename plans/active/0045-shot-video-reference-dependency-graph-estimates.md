# 0045 Media Generation Dependency Graph Estimates

Status: proposed
Date: 2026-06-03

## Summary

The Preview Take Plan dialog currently shows contextual reference cards such as
character sheets, location sheets, and lookbook references without per-card
estimates. In the Urban Basilica project, the final Seedance video estimate is
shown as `$2.27`, but the missing `Narrator` character sheet and `Theodosian
Walls` location sheet cards have no estimate. That is architecturally wrong.

The correct system behavior is generic for every media-generation purpose that
has dependencies:

- every asset needed by a media-generation plan is represented in the
  dependency graph, whether the root purpose is `shot.video-take`,
  `cast.profile`, `location.environment-sheet`, or a future purpose;
- missing generated dependencies use concrete media-generation purposes such as
  `cast.character-sheet`, `location.environment-sheet`, and `lookbook.image`;
- existing assets appear as reused dependency nodes with `$0.00` cost;
- every planned generation node is estimated through the shared
  media-generation purpose registry;
- the plan total is the sum of final video generation plus all priced generated
  dependencies;
- the Preview Take Plan dialog renders dependency graph data directly, including
  per-card pricing.

No Studio-side cost inference, hardcoded UI prices, fake card costs, or
purpose-specific shortcuts are allowed.

The `shot.video-take` reference preview is the first implementation slice
because it exposes the bug today. The architecture must not be specific to shot
video takes.

The old preflight/card estimate paths must be deleted as part of this work. They
must not remain as legacy code, compatibility branches, fallback totals, or
parallel projections.

## Relationship To Existing Plans

This plan completes the reference-dependency slice implied by:

- `plans/active/0042-shot-video-take-generation-plan-architecture.md`
- `plans/active/0043-existing-media-generation-purpose-architecture-refactor.md`
- `plans/active/0044-cli-command-architecture-refactor.md`

Plan `0042` established the dependency map concept for shot-video planning.
Plan `0043` added the shared media-generation purpose registry and generic
lifecycle methods. Plan `0044` will make CLI command routing smaller and more
reviewable.

This plan does not replace those plans. It uses their accepted direction to fix
the current missing reference-estimate behavior.

## Current Failure

The current implementation has three separate sources of truth:

1. `planShotVideoTakeProduction` builds a dependency map and total estimate.
2. `previewShotVideoTakeProduction` still builds obsolete `estimateLines` for
   some missing inputs.
3. `buildShotVideoTakePreflightInputItems` separately creates contextual
   reference cards for cast members, locations, and the active lookbook.

Concrete code symptoms:

- `buildShotVideoTakePreflightInputItems` adds cast/location/lookbook cards from
  scene context but does not assign those cards to dependency graph nodes or
  plan lines.
- Card cost is derived from `ShotVideoTakePreflightInputItem.cost`, but contextual
  reference cards never receive a cost.
- `dependencyForInputKind` maps only shot-local input kinds:
  `first-frame`, `last-frame`, `shot-reference-sheet`, and
  `multi-shot-storyboard-sheet`.
- `character-sheet`, `location-sheet`, and `reference-image` return no concrete
  generation purpose, so they cannot become priced generated dependency nodes.
- Seedance 2.0's `reference` route has an optional provider reference-image
  slot. That provider-level optionality currently lets the plan appear
  `Complete` with only the final video cost, even when the product-level
  reference bundle should be generated or reused.

For `/Users/keremk/renku-movies/urban-basilica`, the project state confirms the
bug:

- `Narrator` exists as a cast member but has no character-sheet asset.
- `Theodosian Walls` exists as a location but has no environment-sheet asset.
- `Imperial Wound` has lookbook images, but they are not surfaced as reusable
  shot-video `reference-image` inputs.
- The preview displays all three as `Needed`, while the total reflects only the
  final video route.

## Goal

Build a purpose-neutral media-generation dependency graph architecture, then use
it to make shot-video reference dependencies first-class graph nodes with
accurate per-node and total estimates.

For the Urban Basilica case, the plan should produce a dependency graph like:

- `cast.character-sheet` planned generation for `Narrator`, priced;
- `location.environment-sheet` planned generation for `Theodosian Walls`,
  priced;
- active `Imperial Wound` lookbook reference image reused from existing lookbook
  assets at `$0.00`, or planned as `lookbook.image` if no valid lookbook image
  exists;
- final `shot.video-take` generation priced;
- total estimate equal to all priced generated lines plus `$0.00` reused lines.

The dialog should show those same line prices in the cards.

The same dependency graph architecture must support other media purposes later,
without adding shot-video-specific fields to the graph contract. Examples:

- `cast.profile` can depend on `cast.character-sheet`;
- `location.environment-sheet` can depend on active lookbook references;
- `scene.storyboard-sheet` can depend on cast sheets, location sheets, and
  lookbook images;
- future audio/video purposes can depend on audio, video, image, or text assets
  through the same slot, selector, and purpose declaration model.

## Non-Goals

This plan does not:

- run paid generation from preview or estimate requests;
- add UI-only prices;
- add compatibility shims for obsolete `estimateLines`, nullable card `cost`,
  final-video-only totals, or any previous preflight/card projection;
- keep obsolete fields as aliases for the new graph contract;
- create a generic `shot.reference-image` purpose;
- duplicate cast, location, lookbook, or shot prompt/provider logic inside the
  shot-video planner;
- infer provider capabilities in Studio;
- silently treat missing prices as `$0.00`;
- preserve obsolete preflight/card data shapes after the graph projection
  replaces them.

## Mandatory Removals

This implementation must remove the obsolete paths in the same slice that adds
the graph-backed replacement. Leaving them in the codebase is prohibited.

Remove these current implementation shapes:

- `ShotVideoTakePreflightReport.estimateLines` as a separate preflight estimate
  projection;
- `ShotVideoTakePreflightInputItem.cost`;
- any UI fallback from `preflight.plan.estimate` to final-video-only
  `preflight.estimate.estimatedCostUsd`;
- `legacyBreakdown` or any equivalent UI branch that reads obsolete estimate
  lines when a plan exists;
- card-specific contextual reference planning that is not backed by dependency
  graph nodes;
- any purpose-to-price mapping in Studio;
- any fake project-relative paths or placeholder input files used only to make a
  final video estimate pass.

After implementation, callers must use:

- `ShotVideoTakePreflightReport.plan`;
- `ShotVideoTakeGenerationPlan.dependencyMap`;
- `ShotVideoTakeGenerationPlan.lines`;
- graph-backed `ShotVideoTakePreflightInputItem.pricing`.

There is no migration period and no compatibility surface.

## Architecture Principles

### Dependency Graph Is The Source Of Truth

The dependency graph must be the only source of truth for:

- which assets are reused;
- which assets must be generated;
- which assets require manual attachment;
- which generation purpose owns each dependency;
- what each dependency costs;
- what the total estimate is;
- which execution order an agent should follow.

The Preview Take Plan dialog, CLI plan output, and agent workflows must read the
same graph.

### Dependencies Use Concrete Purposes

Reference inputs must resolve to the concrete purpose that owns the asset:

- cast reference image -> `cast.character-sheet`;
- location reference image -> `location.environment-sheet`;
- lookbook reference image -> existing `lookbook.image` asset or planned
  `lookbook.image` generation;
- first-frame input -> `shot.first-frame`;
- last-frame input -> `shot.last-frame`;
- shot reference sheet -> `shot.reference-sheet`;
- multi-shot storyboard sheet -> `shot.multi-shot-storyboard-sheet`;
- final video -> `shot.video-take`.

Do not introduce `shot.reference-image`. A reference bundle is a collection of
real domain assets, not a generic hidden shot purpose.

### Provider Optionality Is Not Product Dependency Policy

Some provider routes can technically run without reference images. For example,
Seedance 2.0's `reference` route currently declares reference images as optional
at the provider route level.

That provider fact must not erase product intent. If the user selects the
`reference` intent in Studio, the product is asking for a reference-conditioned
video take. Core must therefore apply a product-level reference dependency
policy:

- derive applicable reference slots from the shot context;
- resolve existing assets for those slots;
- plan generated assets when no valid asset exists and a concrete generation
  purpose exists;
- show manual attachment only when a slot cannot be generated by the current
  product model.

Provider optionality only means the final provider can estimate before all
reference files exist when pricing does not depend on real file content. It does
not mean contextual references disappear from the graph.

### Core Owns Planning

Core owns all project-aware planning for any media-generation purpose:

- reading the root generation context;
- identifying referenced cast, locations, lookbooks, shots, or other domain
  resources required by that purpose;
- selecting or reusing assets;
- planning missing generated dependencies;
- estimating each generation node;
- building total estimate state;
- reporting structured diagnostics.

Studio renders the plan. Studio does not decide which references count,
which purpose generates them, or how much they cost.

### Purpose Modules Own Draft Specs

The dependency resolver must not hand-build provider payloads for another
purpose. For example, `shot.video-take` planning must not hand-build
`cast.character-sheet`, `location.environment-sheet`, or `lookbook.image`
payloads. It asks the owning purpose module to build a draft dependency spec.

Each generation purpose that can be used as a dependency must provide a
purpose-owned draft-spec builder. The builder is responsible for:

- choosing the default model for that purpose;
- creating a valid purpose-specific spec;
- using purpose-specific context and prompt guidance;
- producing stable output names;
- validating through the same path as persisted specs.

The dependency graph stores the draft spec, but the purpose owns its contents.

### Fake Inputs Are Prohibited

The planner must never fabricate project-relative paths, asset files, URLs, or
provider input files to make an estimate succeed.

For plan estimates, a root generation node with unresolved planned dependencies
must use a typed pricing context that contains:

- selected provider model;
- normalized route settings;
- declared dependency slots;
- resolved existing input files;
- planned dependency output descriptors.

If a provider estimator can price the route from settings and declared
cardinality, it should return a price without requiring fake files. If a
provider estimator genuinely requires real file metadata that does not exist
yet, the affected root node is `unpriced` or the plan is `partial`; it must not
be made to look complete with fabricated inputs.

Persisted final `shot.video-take` specs and real runs must use real project
asset files. A final video spec cannot be materialized while any required input
is still planned and not imported.

## Target Data Flow

The generic fixed flow is:

1. A caller asks core to plan a root `MediaGenerationPurpose` and
   `MediaGenerationTarget`. For the current UI bug, Studio calls
   `previewShotVideoTakeProduction` or `estimateShotVideoTakeProduction`, whose
   root purpose is `shot.video-take`.
2. Core builds a media-generation dependency graph for the root purpose. For the
   current shot-video surface, that graph is embedded in
   `ShotVideoTakeGenerationPlan`.
3. The resolver asks the root purpose's
   `MediaGenerationPurposeDependencyDeclaration` for dependency slots. For
   `shot.video-take`, the declaration derives slots from selected intent,
   selected route, shot context, requested inputs, and input policy.
4. Each slot resolves to:
   - an existing project asset node with `$0.00` pricing;
   - a planned generation node with a concrete purpose and estimate;
   - a required attachment node with not-applicable pricing;
   - an unpriced generation node with a structured diagnostic.
5. Planned generation nodes are estimated through
   `estimateMediaGenerationSpec` or an equivalent shared purpose-registry
   draft-estimate helper.
6. The root node is estimated with resolved real inputs and a typed pricing
   context for planned inputs. It must not use fake files or placeholder paths.
7. The graph aggregate computes total estimate state.
8. Core projects graph nodes into generic plan lines and any purpose-specific UI
   projection, such as shot-video `inputPlanItems`.
9. Studio renders cards from graph-backed purpose-specific projection data,
   including pricing.

## Contracts

### Purpose-Neutral Dependency Contracts

Add purpose-neutral dependency contracts in core:

```ts
export type MediaGenerationDependencyKind =
  | 'first-frame'
  | 'last-frame'
  | 'shot-reference-sheet'
  | 'multi-shot-storyboard-sheet'
  | 'cast-character-sheet'
  | 'location-environment-sheet'
  | 'lookbook-reference-image'
  | 'manual-attachment';

export interface MediaGenerationDependencySlot {
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  label: string;
  dependencyTarget?: MediaGenerationTarget;
  required: boolean;
}
```

`dependencyId` is the stable concrete dependency instance id. It identifies the
thing that must be resolved, not the provider route field. Required id shapes:

- `first-frame:<productionGroupId>`
- `last-frame:<productionGroupId>`
- `shot-reference-sheet:<productionGroupId>`
- `multi-shot-storyboard-sheet:<productionGroupId>`
- `cast-character-sheet:<castMemberId>`
- `location-environment-sheet:<locationId>`
- `lookbook-reference-image:<lookbookId>`

`dependencyKind` is the semantic role in the dependency graph. It is the only
field that says what kind of dependency this is.

Do not add `subjectKind`, `subjectId`, or per-slot `routeInputKind` fields. They
split one domain concept across multiple names and invite inconsistent state.

`dependencyTarget` is the media-generation target for this dependency when the
dependency is generated or selected from domain assets. Examples:

- `cast-character-sheet:cast_9fdrsqpr` uses
  `{ kind: 'castMember', id: 'cast_9fdrsqpr' }`;
- `location-environment-sheet:location_pvpc55we` uses
  `{ kind: 'location', id: 'location_pvpc55we' }`;
- `lookbook-reference-image:lookbook_c7g2k6w8` uses
  `{ kind: 'lookbook', id: 'lookbook_c7g2k6w8' }`.

The slot does not carry selector, media-kind, cardinality, missing-behavior, or
generation-purpose fields. Those belong to the dependency-kind registry so every
slot with the same dependency kind resolves consistently.

```ts
export interface MediaGenerationDependencyKindDefinition {
  dependencyKind: MediaGenerationDependencyKind;
  acceptedMediaKinds: MediaKind[];
  cardinality: 'one' | 'many';
  assetSelector: MediaGenerationAssetSelectorId;
  missingInputBehavior: 'plan-generation' | 'require-attachment';
  generationPurpose?: MediaGenerationPurpose;
}
```

Initial dependency-kind definitions:

- `first-frame`
  - media kind: `image`;
  - cardinality: `one`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.first-frame`.
- `last-frame`
  - media kind: `image`;
  - cardinality: `one`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.last-frame`.
- `shot-reference-sheet`
  - media kind: `image`;
  - cardinality: `one`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.reference-sheet`.
- `multi-shot-storyboard-sheet`
  - media kind: `image`;
  - cardinality: `one`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.multi-shot-storyboard-sheet`.
- `cast-character-sheet`
  - media kind: `image`;
  - cardinality: `one`;
  - selector: `cast-character-sheet`;
  - missing behavior: `plan-generation`;
  - generation purpose: `cast.character-sheet`.
- `location-environment-sheet`
  - media kind: `image`;
  - cardinality: `one`;
  - selector: `location-environment-sheet`;
  - missing behavior: `plan-generation`;
  - generation purpose: `location.environment-sheet`.
- `lookbook-reference-image`
  - media kind: `image`;
  - cardinality: `many`;
  - selector: `lookbook-reference-image`;
  - missing behavior: `plan-generation`;
  - generation purpose: `lookbook.image`.

Each media-generation purpose owns dependency declaration for itself:

```ts
export interface MediaGenerationPurposeDependencyDeclaration {
  purpose: MediaGenerationPurpose;
  declareDependencies(
    input: MediaGenerationDependencyDeclarationInput
  ): Promise<MediaGenerationDependencySlot[]>;
}
```

The declaration answers only: "which dependency instances does this purpose need
for this target and spec/route state?"

How resolved dependencies are consumed is also owned by the consuming purpose.
For `shot.video-take`, the shot-video provider-input builder maps
`cast-character-sheet`, `location-environment-sheet`, and
`lookbook-reference-image` to its `reference-image` input role. For
`cast.profile`, a future declaration can map `cast-character-sheet` to whatever
input role the cast-profile provider payload needs. The dependency graph does
not contain a generic `routeInputKind` field.

This keeps the graph purpose-neutral and lets every media-generation purpose
with dependencies use the same resolver, selector, estimate, and materialization
architecture.

### MediaGenerationAssetSelectorId

Add explicit asset selector ids:

```ts
export type MediaGenerationAssetSelectorId =
  | 'shot-video-input'
  | 'cast-character-sheet'
  | 'location-environment-sheet'
  | 'lookbook-reference-image'
  | 'manual-attachment';
```

Selector responsibilities:

- `shot-video-input`: resolves existing shot-video input records for first
  frame, last frame, shot reference sheet, multi-shot storyboard sheet, audio,
  and source video.
- `cast-character-sheet`: resolves selected or valid character-sheet assets for
  a cast member.
- `location-environment-sheet`: resolves selected or valid location environment
  sheet composite assets for a location.
- `lookbook-reference-image`: resolves existing active lookbook images suitable
  for provider reference-image inputs.
- `manual-attachment`: declares that the slot cannot currently be generated and
  requires a user or agent-provided file.

Selectors belong in core because they read project storage and domain asset
relationships. They must not live in Studio.

### MediaGenerationDependencyDraftSpecBuilder

Extend the core media-generation purpose registry with a real dependency-draft
capability:

```ts
export interface MediaGenerationDependencyDraftSpecInput {
  projectName?: string;
  homeDir?: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  slot: MediaGenerationDependencySlot;
  sceneId?: string;
  shotListId?: string;
  shotIds?: string[];
  reason: string;
}

export interface MediaGenerationDependencyDraftSpec {
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  spec: MediaGenerationSpec;
}
```

Add this method to `MediaGenerationPurposeDefinition`:

```ts
buildDependencyDraftSpec?(
  input: MediaGenerationDependencyDraftSpecInput
): Promise<MediaGenerationDependencyDraftSpec>;
```

Required implementations for this plan:

- `lookbook.image`;
- `cast.character-sheet`;
- `location.environment-sheet`;
- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-sheet`;
- `shot.multi-shot-storyboard-sheet`;
- `shot.video-take` for the final node only.

If a dependency declaration references a purpose without
`buildDependencyDraftSpec`, planning must fail with a structured diagnostic.

### MediaGenerationDependencyPricing

Keep the existing pricing shape:

```ts
export type MediaGenerationDependencyPricing =
  | { state: 'priced'; estimatedUsd: number }
  | {
      state: 'unpriced';
      estimatedUsd: null;
      reason: string;
      overrideRequired: true;
    }
  | { state: 'not-applicable'; estimatedUsd: null };
```

Rules:

- reused assets are `priced` with `estimatedUsd: 0`;
- planned generation with a successful estimate is `priced`;
- planned generation with missing pricing is `unpriced`;
- required attachment is `not-applicable`;
- missing generated dependency must never appear as `priced: 0`.

### ShotVideoTakePreflightInputItem

Replace card-only cost fields with graph-backed fields:

```ts
export interface ShotVideoTakePreflightInputItem {
  key: string;
  planLineId: string;
  dependencyNodeId: string;
  title: string;
  caption: string;
  mediaKind: MediaKind;
  status: 'ready' | 'available' | 'planned' | 'attachment-required' | 'unpriced';
  purpose: MediaGenerationPurpose | null;
  pricing: MediaGenerationDependencyPricing;
  assetId?: string;
  assetFileId?: string;
  projectRelativePath?: ProjectRelativePath;
  url?: string;
  slot?: ShotVideoTakePreflightInputSlot;
  candidates?: ShotVideoTakePreflightInputCandidate[];
  selectedInputId?: string | null;
}
```

Do not keep `cost` as a parallel nullable field. The card should render
`pricing`, which is the same pricing used by the total.

## Reference Bundle Dependency Declarations

When the selected `shot.video-take` intent is `reference`, core must derive a
reference bundle from the selected shot group.

For each referenced cast member:

- dependency kind: `cast-character-sheet`;
- dependency id: `cast-character-sheet:<castMemberId>`;
- dependency target: `{ kind: 'castMember', id: castMemberId }`;
- selector, missing behavior, generation purpose, media kind, and cardinality
  come from the `cast-character-sheet` dependency-kind definition;
- pricing is estimated through the shared registry if generation is planned.

For each referenced location:

- dependency kind: `location-environment-sheet`;
- dependency id: `location-environment-sheet:<locationId>`;
- dependency target: `{ kind: 'location', id: locationId }`;
- selector, missing behavior, generation purpose, media kind, and cardinality
  come from the `location-environment-sheet` dependency-kind definition;
- pricing is estimated through the shared registry if generation is planned.

For the active lookbook:

- dependency kind: `lookbook-reference-image`;
- dependency id: `lookbook-reference-image:<lookbookId>`;
- dependency target: `{ kind: 'lookbook', id: lookbookId }`;
- selector, missing behavior, generation purpose, media kind, and cardinality
  come from the `lookbook-reference-image` dependency-kind definition;
- if one or more valid lookbook images exist, reuse them at `$0.00`;
- if no valid lookbook image exists, plan one `lookbook.image` dependency and
  estimate it through the shared registry.

When the selected intent is not `reference`, these bundle slots should not be
added automatically. They may still be added through explicit
`requestedInputs`, but that must go through the same slot declaration and graph
resolution path.

## Non-Shot Dependency Declaration Proof

This architecture must be proven with at least one non-shot root purpose in the
same implementation slice.

Required proof purpose:

- root purpose: `cast.profile`;
- dependency kind: `cast-character-sheet`;
- dependency id: `cast-character-sheet:<castMemberId>`;
- dependency target: `{ kind: 'castMember', id: castMemberId }`;
- behavior:
  - reuse an existing selected character sheet at `$0.00`;
  - when no character sheet exists, plan a `cast.character-sheet` dependency;
  - estimate the planned character sheet through the shared purpose lifecycle;
  - include the dependency and the final `cast.profile` generation in the graph
    total;
  - materialize the final `cast.profile` spec only after the character-sheet
    dependency resolves to a real asset.

This proof prevents the dependency graph from becoming hidden shot-video-only
infrastructure. Additional purposes such as `location.environment-sheet` and
`scene.storyboard-sheet` can add declarations later through the same registry,
without changing the graph contract.

## Existing Asset Resolution

Asset selectors must be deterministic and explicit.

For cast character sheets:

- read `cast_asset` links for the cast member;
- accept assets whose role represents the current selected character sheet;
- resolve the image asset file used by the character sheet;
- if multiple selected assets exist, report a structured diagnostic instead of
  guessing.

For location environment sheets:

- read `location_asset` links for the location;
- accept assets whose role represents the current selected environment sheet;
- resolve the composite image file for the sheet;
- if the sheet lacks a composite file, report a structured diagnostic.

For lookbook references:

- read active lookbook image assets from `lookbook_image`;
- resolve their image files;
- include all valid selected or ordered images up to the selected route's
  `maxCount` when the provider route has one;
- if more images exist than the provider accepts, select deterministically by
  lookbook image order and report a structured warning that extra images were
  not included.

For all selectors:

- missing optional metadata is not a reason to guess;
- missing required asset files are structured errors;
- selection ambiguity is a structured error;
- selected existing assets contribute `$0.00` to the total.

## Final Video Estimate Behavior

The final video estimate must include dependency outputs as inputs when the
selected route expects them.

During preview:

- existing assets use their real project-relative paths;
- planned dependency outputs are represented by typed dependency output
  descriptors;
- required attachments produce missing nodes and prevent a complete final plan;
- final pricing may still be computed when the engine estimator only depends on
  route settings such as duration and resolution.

During spec materialization and run:

- fake files, fake URLs, fake project-relative paths, and placeholder inputs are
  prohibited;
- every required provider input must resolve to a real project asset file;
- the final `shot.video-take` spec cannot be persisted until planned dependency
  outputs have been generated, imported, and visible in the refreshed graph.

## Estimate State Rules

Use these state rules for `ShotVideoTakeGenerationPlan.estimate`:

- `complete`: every runnable generation line is priced and no required
  attachment is missing;
- `partial`: at least one runnable generation line is unpriced but no required
  attachment is missing;
- `unavailable`: the plan has a required attachment, invalid route, invalid
  selector result, missing draft-spec builder, invalid draft spec, or another
  error that prevents a trustworthy full plan.

`estimatedTotalUsd` rules:

- for `complete`, sum all priced lines including final video and `$0.00` reused
  assets;
- for `partial`, sum priced lines and expose unpriced lines separately;
- for `unavailable`, use `null`.

The Preview Take Plan dialog must not show `Complete` unless the graph estimate
state is `complete`.

## Package-Level Implementation Plan

### Engines

Engines already owns shot-video route definitions and pricing. This plan does
not require Studio to inspect engines directly.

Required engine work:

- expose route input cardinality to core planning when a consuming purpose needs
  it;
- keep provider optionality as provider schema data;
- do not encode product-level reference bundle policy in engines.

### Core

Add focused core modules:

- `packages/core/src/server/media-generation/dependency-graph.ts`
- `packages/core/src/server/media-generation/dependency-kind-registry.ts`
- `packages/core/src/server/media-generation/dependency-declaration-registry.ts`
- `packages/core/src/server/media-generation/dependency-asset-selectors.ts`
- `packages/core/src/server/media-generation/dependency-draft-specs.ts`
- `packages/core/src/server/media-generation/media-generation-plan-projection.ts`
- `packages/core/src/server/media-generation/shot-video-take-dependency-declaration.ts`
- `packages/core/src/server/media-generation/shot-video-take-plan-projection.ts`

Responsibilities:

- `dependency-graph.ts`: graph node creation, edge creation, aggregate estimate,
  topological ordering, cycle diagnostics.
- `dependency-kind-registry.ts`: registered dependency kinds, selectors,
  cardinality, media-kind support, missing-input behavior, and generation
  purpose defaults.
- `dependency-declaration-registry.ts`: purpose-owned dependency declarations
  for every media-generation purpose that has dependencies.
- `dependency-asset-selectors.ts`: project DB asset resolution for dependency
  slots through dependency-kind definitions.
- `dependency-draft-specs.ts`: calls purpose registry draft builders, validates
  draft specs, estimates draft specs.
- `media-generation-plan-projection.ts`: converts dependency map nodes into
  generic `MediaGenerationPlanLine` values.
- `shot-video-take-dependency-declaration.ts`: declares `shot.video-take`
  dependency slots as the first concrete consumer of the generic dependency
  graph.
- `shot-video-take-plan-projection.ts`: converts generic plan lines into
  `ShotVideoTakePreflightInputItem` values for the current Studio dialog.

Update existing core files:

- `packages/core/src/server/media-generation/purpose-registry.ts`
  - add optional `buildDependencyDraftSpec`;
  - fail fast when a dependency purpose has no builder.
- `packages/core/src/server/media-generation/shared-generation-service.ts`
  - add a draft-spec estimate helper or reuse existing validation/prepare/
    estimate functions without persisting.
- `packages/core/src/server/media-generation/shot-video-take.ts`
  - delete obsolete card-specific contextual reference planning;
  - use the generic dependency graph for all reference inputs;
  - derive `inputPlanItems` from graph-backed plan lines;
  - delete `estimateLines` from the preflight contract and update all callers to
    read `plan.lines`.

### Studio

Update the Preview Take Plan dialog to render graph-backed input items:

- show `$0.00` for reused assets;
- show the generated dependency estimate for planned nodes;
- show `Unpriced` for unpriced nodes with a tooltip or compact reason;
- show `Attach needed` for manual attachment nodes;
- compute the footer total from `preflight.plan.estimate`;
- do not render card prices from a separate nullable `cost` field;
- do not label optional contextual references as `Needed` unless they are graph
  nodes that are planned, missing, or attachment-required.
- delete all fallback UI branches that read obsolete estimate fields.

Studio feature code must continue to use local shadcn UI primitives. No raw form
or interactive controls are allowed.

### CLI And Agent Surfaces

The CLI should expose the same graph through the future `generation plan`
command from plan `0042` or through a small handler under plan `0044`.

Required contract:

- no CLI-side dependency pricing;
- no CLI-side reference bundle inference;
- CLI output prints graph nodes, plan lines, total estimate, diagnostics, and
  execution levels from core;
- media-producer agents execute graph levels and refresh the plan after each
  imported dependency.

This plan does not require completing the whole CLI refactor before core tests
pass, but the CLI plan output must not invent a second graph projection.

## Diagnostics

Use structured diagnostics with stable codes. Proposed codes:

- `CORE_MEDIA_DEPENDENCY_UNREGISTERED_PURPOSE`
- `CORE_MEDIA_DEPENDENCY_MISSING_DRAFT_BUILDER`
- `CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC`
- `CORE_MEDIA_DEPENDENCY_ESTIMATE_FAILED`
- `CORE_MEDIA_DEPENDENCY_UNPRICED_NODE`
- `CORE_MEDIA_DEPENDENCY_SELECTOR_MISSING_ASSET_FILE`
- `CORE_MEDIA_DEPENDENCY_SELECTOR_AMBIGUOUS_SELECTION`
- `CORE_MEDIA_DEPENDENCY_REFERENCE_BUNDLE_EMPTY`
- `CORE_MEDIA_DEPENDENCY_ROUTE_CARDINALITY_EXCEEDED`
- `CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED`
- `CORE_SHOT_VIDEO_REFERENCE_DEPENDENCY_REQUIRED`

Do not throw loose `Error` values from package-boundary paths.

## Integration Test Plan

All tests should live under `packages/core/tests/integration`.

### New Test File: `media-generation-dependency-graph-contract.test.ts`

This file proves the dependency graph is purpose-neutral.

Required tests:

- `dependency kind registry owns selector, media kind, cardinality, missing behavior, and generation purpose`
  - assert `MediaGenerationDependencySlot` instances contain only
    dependency identity, target, label, and required state;
  - assert selectors and generation purposes are read from dependency-kind
    definitions, not duplicated per slot.

- `dependency declaration registry supports multiple root purposes`
  - assert declarations exist for `shot.video-take` and `cast.profile`;
  - assert the resolver uses the same graph path for both root purposes.

- `dependency graph nodes are purpose-neutral`
  - assert graph nodes do not expose shot-video route input fields;
  - assert nodes reference `dependencyKind` and `dependencyId`.

- `consumer purpose owns resolved dependency input mapping`
  - assert `shot.video-take` maps cast/location/lookbook dependencies to its
    reference input role outside the generic graph;
  - assert `cast.profile` maps character-sheet dependency inputs outside the
    generic graph.

### New Test File: `cast-profile-dependency-graph-estimates.test.ts`

This file proves a non-shot media-generation purpose can use the same
dependency graph.

Required tests:

- `cast profile plans missing character sheet as a priced generated dependency`
  - create a cast member with no character-sheet asset;
  - call the generic media-generation plan/estimate path for `cast.profile`;
  - assert a `cast-character-sheet` dependency node exists;
  - assert the node plans `cast.character-sheet`;
  - assert the node is priced through the shared registry;
  - assert the total includes character-sheet generation plus final
    `cast.profile` generation.

- `cast profile reuses existing character sheet as zero-cost dependency`
  - create or import a selected character-sheet asset for the cast member;
  - plan `cast.profile`;
  - assert the character-sheet node is `existing-asset`;
  - assert pricing is `$0.00`;
  - assert the total includes only the final `cast.profile` generation.

- `cast profile materialization rejects unresolved planned character sheet`
  - plan `cast.profile` with a missing character sheet;
  - assert the final profile spec cannot be materialized until the
    character-sheet dependency is generated and imported.

### New Test File: `shot-video-reference-dependency-graph-estimates.test.ts`

This file should cover the user-visible regression.

Required tests:

- `reference intent plans missing cast and location references as priced generated dependencies`
  - create a project with a shot referencing one cast member and one location;
  - do not attach character-sheet or environment-sheet assets;
  - call `estimateShotVideoTakeProduction` with `intentId: 'reference'`;
  - assert dependency nodes include `cast.character-sheet` and
    `location.environment-sheet`;
  - assert both nodes are `planned-generation`;
  - assert both nodes have `pricing.state === 'priced'`;
  - assert the final video node is priced;
  - assert total equals dependency prices plus final video price.

- `reference intent uses existing cast and location assets as zero-cost dependency nodes`
  - import or create valid character-sheet and environment-sheet assets;
  - call the same plan;
  - assert graph nodes are `existing-asset`;
  - assert pricing is `$0.00`;
  - assert no generated dependency node is created for those subjects;
  - assert total equals final video plus any other generated dependencies.

- `reference intent reuses active lookbook images as zero-cost reference inputs`
  - create an active lookbook with one or more lookbook images;
  - call the plan;
  - assert lookbook reference nodes resolve to existing assets;
  - assert pricing is `$0.00`;
  - assert final video input resolution includes lookbook image files.

- `reference intent plans a lookbook image when the active lookbook has no reusable image`
  - create an active lookbook without images;
  - call the plan;
  - assert a `lookbook.image` planned-generation node exists;
  - assert it is priced;
  - assert total includes that price.

- `reference intent applies product reference dependencies even when provider reference images are optional`
  - use Seedance 2.0 reference route;
  - assert cast/location/lookbook reference bundle nodes are still declared;
  - assert the plan is complete only when generated/reused dependency nodes are
    all priced or ready.

- `non-reference intents do not auto-add contextual reference bundle dependencies`
  - use the same scene context with `text-only` and `first-frame` intents;
  - assert cast/location/lookbook reference bundle nodes are absent unless
    explicitly requested through `requestedInputs`.

### New Test File: `shot-video-reference-dependency-input-policy.test.ts`

Required tests:

- `auto policy reuses valid selected assets and plans only missing references`;
- `regenerate slot policy creates a planned generation node even when a valid asset exists`;
- `reuse-selected policy reports a structured diagnostic when multiple selected assets match one slot`;
- `manual attachment dependencies appear as required attachments with not-applicable pricing`;
- `dependency ids are stable across repeated plans for the same production group`.

### New Test File: `shot-video-reference-dependency-plan-projection.test.ts`

Required tests:

- `preflight input items are projected from dependency graph nodes`;
- `every planned generation card has the same pricing as its graph node`;
- `reused asset cards show zero-cost pricing`;
- `unpriced nodes render as unpriced card data rather than null cost`;
- `there is no needed card with null cost when a concrete generation purpose can satisfy the slot`;
- `footer total equals graph aggregate estimate and no final-video-only fallback exists`.

These are core integration tests because the projection is produced by core
client/server contracts, even though Studio renders the final UI.

### New Test File: `media-generation-dependency-purpose-registry-contract.test.ts`

Required tests:

- `every dependency declaration purpose is registered in the media-generation purpose registry`;
- `every dependency declaration target kind matches the registered purpose target kind`;
- `every planned dependency purpose has a dependency draft spec builder`;
- `draft dependency specs validate through the shared purpose lifecycle`;
- `draft dependency estimates use the same engine estimate path as persisted specs`;
- `missing draft builder produces a structured diagnostic`.

### New Test File: `shot-video-reference-dependency-materialization.test.ts`

Required tests:

- `planned dependency specs can be persisted node by node through the shared lifecycle`;
- `final video spec materialization fails while dependency outputs are still planned`;
- `after a dependency output is imported, refreshed plan uses the real asset as a reused input`;
- `execution levels place independent cast/location/lookbook generations before final video`;
- `final video generation is not included in executable levels until required dependencies resolve`.

### New Test File: `shot-video-reference-dependency-diagnostics.test.ts`

Required tests:

- `missing asset file in a selected character sheet returns structured diagnostics`;
- `missing composite image for a selected location sheet returns structured diagnostics`;
- `too many lookbook images for a bounded provider route selects deterministically and warns`;
- `ambiguous selected asset state fails fast with structured diagnostics`;
- `dependency declaration cycle detection returns structured diagnostics`;
- `unpriced dependency estimate marks the total partial and requires override`.

### Regression Fixture Shape

Add a focused fixture helper that mirrors the Urban Basilica failure without
depending on `/Users/keremk/renku-movies/urban-basilica`:

- project with an active lookbook named `Imperial Wound`;
- one cast member named `Narrator`;
- one location named `Theodosian Walls`;
- one scene with one shot referencing both;
- reference intent with Seedance 2.0;
- no character sheet for Narrator;
- no environment sheet for Theodosian Walls;
- at least one lookbook image for the reuse case and no lookbook image for the
  generation case.

Do not read from a developer-local project path in tests.

## Expected Urban Basilica Result

After implementation, the current screenshot case should behave like this:

- `Narrator / Character sheet`
  - status: `Planned`;
  - purpose: `cast.character-sheet`;
  - card estimate: priced image-generation cost.
- `Theodosian Walls / Location sheet`
  - status: `Planned`;
  - purpose: `location.environment-sheet`;
  - card estimate: priced image-generation cost.
- `Imperial Wound / Lookbook reference`
  - status: `Ready` or `Available` if existing lookbook images are reused;
  - card estimate: `$0.00`;
  - if no valid lookbook image exists, status: `Planned`, purpose:
    `lookbook.image`, card estimate: priced image-generation cost.
- `Final video take`
  - status: `Planned`;
  - purpose: `shot.video-take`;
  - estimate: Seedance 2.0 route cost.
- footer total:
  - sum of the above priced lines;
  - state `Complete` only if every generated line is priced and no required
    attachment is missing.

## Implementation Phases

### Phase 1: Contract Audit

- Confirm current client types for `MediaGenerationDependencyMap`,
  `MediaGenerationDependencyNode`, `MediaGenerationPlanLine`, and
  `ShotVideoTakePreflightInputItem`.
- Identify every caller of obsolete `estimateLines` and nullable card `cost`.
- Plan the direct caller updates needed to delete those fields in this slice.
- Confirm exact asset-file selection rules for character sheets, location
  environment sheets, and lookbook images.
- Confirm route cardinality rules needed by reference-image provider inputs.

### Phase 2: Generic Dependency Graph Foundation

- Add `MediaGenerationDependencySlot`.
- Add `MediaGenerationDependencyKind`.
- Add `MediaGenerationDependencyKindDefinition`.
- Add `MediaGenerationPurposeDependencyDeclaration`.
- Add the dependency-kind registry.
- Add the dependency-declaration registry.
- Add `MediaGenerationAssetSelectorId`.
- Add generic dependency graph resolution, estimate aggregation, diagnostics,
  and execution-level ordering.

### Phase 3: Dependency Declarations And Selectors

- Implement asset selectors for cast character sheets, location environment
  sheets, lookbook images, shot-video inputs, and manual attachments.
- Add structured diagnostics for missing, ambiguous, or invalid selected assets.

### Phase 4: Purpose-Owned Draft Spec Builders

- Extend `MediaGenerationPurposeDefinition` with
  `buildDependencyDraftSpec`.
- Add builders for `lookbook.image`, `cast.character-sheet`,
  `location.environment-sheet`, `shot.first-frame`, `shot.last-frame`,
  `shot.reference-sheet`, and `shot.multi-shot-storyboard-sheet`.
- Validate all draft specs through the existing shared lifecycle.
- Estimate draft specs without persisting them.

### Phase 5: Non-Shot Dependency Proof

- Add a `cast.profile` dependency declaration.
- Reuse an existing `cast-character-sheet` dependency at `$0.00`.
- Plan and estimate a missing `cast.character-sheet` dependency.
- Include dependency plus final `cast.profile` estimate in the same graph total.
- Prove final `cast.profile` materialization waits for real dependency assets.

### Phase 6: Shot-Video Reference Bundle Resolver

- Replace ad hoc reference card creation with reference dependency slots.
- Apply reference bundle policy for `intentId: 'reference'`.
- Reuse existing assets as zero-cost nodes.
- Plan missing cast/location/lookbook assets as generated dependency nodes.
- Respect input policy for reuse and regenerate behavior.

### Phase 7: Plan Aggregation And Projection

- Aggregate dependency and final video pricing into one graph estimate.
- Derive `MediaGenerationPlanLine` from graph nodes.
- Derive `ShotVideoTakePreflightInputItem` from graph-backed plan lines.
- Delete obsolete nullable `cost` projection.
- Delete obsolete `estimateLines` projection.
- Ensure `previewShotVideoTakeProduction` and `estimateShotVideoTakeProduction`
  use the same plan source.

### Phase 8: Studio Dialog Update

- Render card price from `item.pricing`.
- Show `$0.00`, priced estimates, `Unpriced`, or `Attach needed` explicitly.
- Show footer total from `preflight.plan.estimate`.
- Delete all fallback branches to final-video-only totals.
- Keep UI controls on local shadcn primitives only.

### Phase 9: Integration Tests

- Add all required tests listed in the Integration Test Plan.
- Keep tests under `packages/core/tests/integration`.
- Use deterministic fixtures and deterministic id generators.
- Do not use the developer-local Urban Basilica project path.

### Phase 10: Verification

Run:

```bash
pnpm --dir packages/core test
pnpm --dir packages/core build
pnpm --dir packages/studio build
pnpm lint
pnpm check
pnpm test
```

If Studio rendering changes are substantial, also run the local Studio app and
visually verify the Preview Take Plan dialog for the regression fixture or an
equivalent local project.

## Acceptance Criteria

- The dependency graph contracts are purpose-neutral and contain no shot-video
  route input fields.
- The generic dependency-kind registry owns selector, media-kind, cardinality,
  missing-input behavior, and generation-purpose defaults.
- The generic dependency-declaration registry supports more than one root
  media-generation purpose.
- `cast.profile` proves a non-shot purpose can plan, estimate, and materialize
  through the same dependency graph architecture.
- Reference-bundle dependencies are graph nodes, not separate contextual cards.
- Missing cast character sheets plan `cast.character-sheet` generation nodes.
- Missing location environment sheets plan `location.environment-sheet`
  generation nodes.
- Active lookbook images resolve as reusable zero-cost reference inputs.
- Empty active lookbooks can plan `lookbook.image` generation nodes.
- Every planned generation node is estimated through the shared purpose
  lifecycle.
- The total estimate includes dependencies and final video.
- The dialog card price for each dependency matches the graph node price.
- No card displays a null or dash estimate when a concrete generated dependency
  can satisfy the slot.
- Provider optional reference-image slots do not erase product-level reference
  dependency policy.
- Final persisted video specs never use fake inputs, fake files, fake URLs, or
  fake project-relative paths.
- No obsolete preflight estimate fields, nullable card costs, compatibility
  branches, or final-video-only fallback totals remain.
- Integration tests cover the regression and graph contracts.

## Completion Checklist

Use this checklist to track the implementation. The refactor is not complete
until every item is either checked or explicitly replaced by a reviewed plan
change.

### Review And Scope

- [ ] Confirm the target bug is the missing estimates for shot-video reference
  dependency cards.
- [ ] Confirm the fix is dependency-graph based, not UI-price based.
- [ ] Confirm no generic `shot.reference-image` purpose is introduced.
- [ ] Confirm cast/location/lookbook dependencies use concrete existing media
  purposes.
- [ ] Confirm provider optionality does not override product-level reference
  dependency policy.
- [ ] Confirm obsolete estimate/card fields are deleted, not wrapped.
- [ ] Confirm no compatibility shim preserves the old nullable card-cost model.
- [ ] Confirm no fallback branch preserves final-video-only totals.
- [ ] Confirm no fake files or placeholder paths are used for estimates.

### Architecture Contracts

- [ ] Add `MediaGenerationDependencySlot`.
- [x] Add `MediaGenerationDependencyKind`.
- [ ] Add `MediaGenerationDependencyKindDefinition`.
- [ ] Add `MediaGenerationPurposeDependencyDeclaration`.
- [ ] Add the generic dependency-kind registry.
- [ ] Add the generic dependency-declaration registry.
- [ ] Add `MediaGenerationAssetSelectorId`.
- [ ] Confirm dependency kind definitions own media kind, cardinality, selector,
  missing behavior, and default generation purpose.
- [ ] Confirm consuming purposes own how resolved dependencies become their
  purpose-specific inputs.
- [x] Confirm slots do not carry `subjectKind`, `subjectId`, or
  `routeInputKind`.
- [x] Add graph-backed fields to `ShotVideoTakePreflightInputItem`.
- [x] Delete nullable `ShotVideoTakePreflightInputItem.cost`.
- [x] Delete `ShotVideoTakePreflightReport.estimateLines`.
- [ ] Add `MediaGenerationDependencyDraftSpecInput`.
- [ ] Add `MediaGenerationDependencyDraftSpec`.
- [ ] Extend `MediaGenerationPurposeDefinition` with
  `buildDependencyDraftSpec`.
- [ ] Add structured diagnostics for missing draft builders.
- [ ] Add structured diagnostics for invalid dependency declarations.
- [ ] Add structured diagnostics for invalid selector results.

### Asset Selectors

- [ ] Implement `cast-character-sheet` selector.
- [ ] Implement `location-environment-sheet` selector.
- [ ] Implement `lookbook-reference-image` selector.
- [ ] Implement `shot-video-input` selector.
- [ ] Implement `manual-attachment` selector behavior.
- [ ] Resolve character-sheet image files deterministically.
- [ ] Resolve location environment-sheet composite files deterministically.
- [ ] Resolve lookbook image files deterministically.
- [ ] Report ambiguous selected assets as structured diagnostics.
- [ ] Report missing selected asset files as structured diagnostics.
- [ ] Apply provider max-count limits to many-image lookbook references.

### Dependency Draft Spec Builders

- [x] Add a draft builder for `lookbook.image`.
- [x] Add a draft builder for `cast.character-sheet`.
- [ ] Add or update a consumer dependency declaration for `cast.profile`.
- [x] Add a draft builder for `location.environment-sheet`.
- [x] Add a draft builder for `shot.first-frame`.
- [x] Add a draft builder for `shot.last-frame`.
- [x] Add a draft builder for `shot.reference-sheet`.
- [x] Add a draft builder for `shot.multi-shot-storyboard-sheet`.
- [x] Validate every draft spec through the shared purpose lifecycle.
- [x] Estimate every draft spec through the shared engine estimate path.
- [x] Ensure shot-video planner does not build non-shot provider payloads.
- [ ] Ensure the generic resolver can plan dependencies for a non-shot root
  purpose.

### Non-Shot Purpose Proof

- [ ] Declare `cast.profile` dependency slots through
  `MediaGenerationPurposeDependencyDeclaration`.
- [ ] Reuse an existing `cast-character-sheet` dependency for `cast.profile` at
  `$0.00`.
- [ ] Plan a missing `cast-character-sheet` dependency for `cast.profile`.
- [ ] Include the planned `cast.character-sheet` estimate in the `cast.profile`
  graph total.
- [ ] Prevent `cast.profile` spec materialization until required planned
  dependencies resolve to real assets.
- [ ] Confirm the `cast.profile` implementation uses the same graph resolver,
  selectors, draft builders, and estimate aggregation as `shot.video-take`.

### Shot-Video Reference Bundle

- [x] Declare cast character-sheet slots for referenced cast members.
- [x] Declare location environment-sheet slots for referenced locations.
- [x] Declare active lookbook reference-image slots.
- [x] Apply reference bundle slots automatically for `intentId: 'reference'`.
- [x] Do not apply reference bundle slots automatically for non-reference
  intents.
- [x] Support explicit `requestedInputs` through the same slot/dependency path.
- [ ] Reuse existing reference assets at `$0.00`.
- [x] Plan missing generated reference assets with concrete purposes.
- [x] Respect `auto`, `reuse-selected`, and `regenerate` input policy modes.
- [x] Produce stable dependency node ids and dependency ids.
- [ ] Map `cast-character-sheet`, `location-environment-sheet`, and
  `lookbook-reference-image` to shot-video reference inputs inside the
  `shot.video-take` consumer input builder, not inside the generic graph slot.

### Estimate Aggregation

- [x] Price reused assets as `$0.00`.
- [x] Price planned generated dependencies through shared estimates.
- [x] Mark missing prices as `unpriced`, never `$0.00`.
- [x] Mark manual attachments as `not-applicable`.
- [x] Include dependency estimates in `plan.estimate.estimatedTotalUsd`.
- [x] Include the root generation node estimate in
  `plan.estimate.estimatedTotalUsd`.
- [x] Include final video estimate in `plan.estimate.estimatedTotalUsd` for
  `shot.video-take`.
- [x] Mark the plan `complete` only when every runnable line is priced and no
  required attachment is missing.
- [x] Mark the plan `partial` when at least one runnable line is unpriced.
- [ ] Mark the plan `unavailable` for invalid routes, invalid selectors,
  missing required attachments, invalid draft specs, or missing draft builders.
- [x] Ensure `estimateShotVideoTakeProduction` and
  `previewShotVideoTakeProduction` use the same graph estimate.
- [x] Ensure final video estimates use typed pricing context, not fake files.

### Plan Projection

- [x] Derive `MediaGenerationPlanLine` from dependency graph nodes.
- [x] Derive `ShotVideoTakePreflightInputItem` from plan lines.
- [x] Include `planLineId` on every input item.
- [x] Include `dependencyNodeId` on every input item.
- [x] Include `purpose` on every input item.
- [x] Include `pricing` on every input item.
- [x] Remove separate contextual reference card creation.
- [x] Remove separate nullable card-cost lookup.
- [x] Remove every caller of `estimateLines`.
- [x] Preserve candidate input picker data where reused/available assets exist.
- [x] Ensure every visible dependency card corresponds to a graph node.

### Materialization And Run Safety

- [x] Prohibit fake project-relative paths in plan estimates.
- [x] Prohibit fake asset files in plan estimates.
- [x] Prohibit fake URLs in plan estimates.
- [x] Prohibit fake inputs in persisted final video specs.
- [x] Prohibit fake inputs in run provider payloads.
- [ ] Use typed dependency output descriptors for planned dependencies during
  read-only pricing.
- [ ] Materialize planned dependency specs node by node.
- [ ] Refresh the graph after dependency imports.
- [ ] Materialize final video specs only after required inputs resolve to real
  project asset files.
- [ ] Preserve approval-token behavior for priced generation nodes.
- [ ] Preserve explicit unpriced override behavior for unpriced generation
  nodes.

### Studio Dialog

- [x] Render dependency cards from graph-backed input items.
- [x] Show `$0.00` for reused assets.
- [x] Show priced estimates for planned generated dependencies.
- [x] Show `Unpriced` for unpriced generated dependencies.
- [x] Show `Attach needed` for manual attachment nodes.
- [x] Show footer total from `preflight.plan.estimate`.
- [x] Delete fallback to final-video-only totals.
- [x] Delete obsolete `legacyBreakdown` UI logic.
- [x] Delete every UI read of `estimateLines`.
- [x] Delete every UI read of nullable card `cost`.
- [x] Keep controls on local shadcn UI primitives.
- [x] Avoid invented visible copy that is not backed by product data.

### Core Integration Tests

- [ ] Add `media-generation-dependency-graph-contract.test.ts`.
- [ ] Test dependency-kind definitions own selector, media kind, cardinality,
  missing behavior, and generation purpose.
- [ ] Test dependency declarations support both `shot.video-take` and
  `cast.profile`.
- [x] Test graph nodes are purpose-neutral and expose no shot-video route input
  fields.
- [ ] Test consuming purposes own resolved dependency input mapping.
- [ ] Add `cast-profile-dependency-graph-estimates.test.ts`.
- [ ] Test missing cast profile character sheet becomes a priced
  `cast.character-sheet` dependency.
- [ ] Test existing cast profile character sheet becomes a zero-cost reused
  dependency.
- [ ] Test `cast.profile` materialization rejects unresolved planned character
  sheet dependencies.
- [ ] Add `shot-video-reference-dependency-graph-estimates.test.ts`.
- [x] Test missing cast/location references become priced generated dependency
  nodes.
- [ ] Test existing cast/location assets become zero-cost reused nodes.
- [ ] Test active lookbook images become zero-cost reused reference inputs.
- [x] Test empty active lookbook plans a priced `lookbook.image` dependency.
- [x] Test Seedance reference route still applies product reference
  dependencies even though provider reference images are optional.
- [x] Test non-reference intents do not auto-add reference bundle dependencies.
- [ ] Add `shot-video-reference-dependency-input-policy.test.ts`.
- [ ] Test `auto` policy.
- [ ] Test `reuse-selected` policy.
- [ ] Test `regenerate` policy.
- [ ] Test manual attachment nodes.
- [x] Test stable dependency ids.
- [x] Test generic dependency slots do not expose shot-video route input fields.
- [ ] Test shot-video input mapping is owned by the `shot.video-take` consumer
  input builder.
- [ ] Add `shot-video-reference-dependency-plan-projection.test.ts`.
- [x] Test every card maps to a dependency node.
- [x] Test card pricing equals node pricing.
- [x] Test no generatable dependency card has null cost.
- [x] Test the preflight response no longer exposes `estimateLines`.
- [x] Test the preflight input item response no longer exposes nullable `cost`.
- [x] Test footer total equals graph aggregate.
- [ ] Add `media-generation-dependency-purpose-registry-contract.test.ts`.
- [ ] Test every declared dependency purpose is registered.
- [ ] Test every declared dependency target kind matches registry metadata.
- [x] Test every planned dependency purpose has a draft builder.
- [x] Test draft specs validate and estimate through shared lifecycle.
- [ ] Add `shot-video-reference-dependency-materialization.test.ts`.
- [ ] Test dependency node spec persistence.
- [ ] Test final spec rejects planned dependency descriptors until real assets
  exist.
- [ ] Test final spec and run payloads contain no fake paths, files, or URLs.
- [ ] Test refreshed plan uses imported dependency assets.
- [ ] Test execution levels order dependencies before final video.
- [ ] Add `shot-video-reference-dependency-diagnostics.test.ts`.
- [ ] Test missing asset-file diagnostics.
- [ ] Test missing location composite diagnostics.
- [ ] Test lookbook max-count warning.
- [ ] Test ambiguous selection diagnostics.
- [ ] Test cycle diagnostics.
- [ ] Test unpriced dependency partial estimate behavior.

### Documentation

- [ ] Update `docs/architecture/media-generation.md` with reference dependency
  graph behavior.
- [ ] Update `docs/architecture/reference/media-generation.md` with the
  dependency slot and selector contracts.
- [x] Add or update an ADR if implementation changes the accepted dependency
  graph contract from plan `0042`.
- [ ] Reference this plan from any follow-up CLI or media-producer skill plan
  that uses dependency execution levels.

### Final Verification

- [x] Run `pnpm --dir packages/core test`.
- [x] Run `pnpm --dir packages/core build`.
- [x] Run `pnpm --dir packages/studio build`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm check`.
- [x] Run `pnpm test`.
- [x] Verify the Urban Basilica-style fixture shows dependency estimates in
  cards.
- [x] Verify the total includes video plus all generated dependencies.
- [x] Verify no dependency estimate is silently omitted.
- [x] Document any checks not run and why.
