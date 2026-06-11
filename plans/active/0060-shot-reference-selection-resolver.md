# 0060 Complete Shared Media Generation Dependency Graph Architecture

Status: implemented
Date: 2026-06-11

## Summary

The shot References tab bug is not just a cast-card bug. It is a symptom of an
unfinished architecture.

Renku Studio already accepted the right direction in
`docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`:
dependency graphs are part of the shared media-generation architecture, not a
shot-video-only concern. The implementation only partially follows that
decision today. `shot.video-take` has a local dependency map, but that map is
still built, priced, and projected through shot-specific code. The References
tab then mixes that graph with separate scene-scope and asset-card logic. That
is why locations could be patched while Mara still rendered as a heading with no
reference card.

This plan completes the shared dependency graph architecture and uses it as the
single source of truth for:

- which dependencies a generation needs;
- which existing assets satisfy those dependencies;
- which missing assets must be generated;
- which purpose owns each generated dependency;
- what each generation costs;
- what the total estimate is;
- what references are shown in Studio;
- what execution order agents and CLI workflows should follow.

There is one pricing meaning only:

> A price is the provider estimate for a generation request, produced through
> the engines package. The total estimate is the sum of graph generation nodes
> required for the root generation, including the root generation itself.

No Studio-side prices, catalog-option prices, fake card costs, fallback totals,
or second pricing model are allowed.

## Implementation Result

Implemented on 2026-06-11.

The accepted ADR was added as
`docs/decisions/0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`
because ADR number `0027` was already occupied.

The implementation added the shared dependency kind registry, asset selectors,
draft dependency spec estimation, dependency graph resolver, graph aggregate,
and plan-line projection under `packages/core/src/server/media-generation`.
`shot.video-take` now uses the shared graph resolver and graph estimate instead
of local aggregate and non-shot draft-spec construction. `cast.profile` is the
first non-shot proof and declares a `cast-character-sheet` dependency through
the same graph path.

Root media generation spec creation and update now refuse to persist a spec
while required graph dependencies are still planned or missing. Existing
dependency assets satisfy graph slots at `$0.00`; missing generated dependency
prices come from engines estimates through the shared generation lifecycle.

The References tab projection remains purpose-specific for shot video, but its
planned cast, location, and Lookbook cards are graph-backed and share the same
dependency-node pricing path. Follow-up work should continue extracting
shot-video-only projection code into a smaller purpose module, but the shared
pricing and dependency graph architecture is now in place.

## Deep Dive Findings

### Accepted Architecture Already Exists

`docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
states that dependency graphs are shared media-generation architecture. It also
states that draft dependency specs are estimated through the same purpose
registry and provider payload builders as persisted specs.

`docs/architecture/media-generation.md` repeats the same boundary:

- the shared service owns registry-backed lifecycle operations;
- purpose definitions own context, validation, provider payloads, output names,
  dependency declarations, and import behavior;
- generated media does not become project metadata until explicit import.

`docs/architecture/reference/media-generation.md` says `shot.video-take`
preflight is the authoritative dependency check and agents should read
`inputsToCreate`, `inputPlanItems`, `plan.dependencyMap`, `prompts`, and
`finalTake.canCreateSpec`.

The direction is therefore not missing from the architecture. The implementation
has not caught up.

### Pricing Has One Real Source

`packages/core/src/server/media-generation/shared-generation-service.ts`
already estimates persisted and draft specs by preparing the purpose-owned
generation request and passing it to `estimateGeneration`.

`@gorenku/studio-engines` owns the provider model pricing. Core should ask
engines for estimates through the shared service. Studio must never invent or
normalize prices.

The current client graph contracts already model this correctly:

- `MediaGenerationDependencyPricing`;
- `MediaGenerationDependencyNode`;
- `MediaGenerationDependencyMap`;
- `MediaGenerationPlanLine`;
- `ShotVideoTakeGenerationPlan`.

Those contracts do not need two kinds of prices. They need a completed shared
resolver and consistent projection.

### Current Graph Implementation Is Shot-Local

The concrete implementation still lives inside
`packages/core/src/server/media-generation/shot-video-take.ts`.

This file currently owns all of these responsibilities:

- deriving required dependency slots in `requiredInputSlots`;
- deriving cast/location/lookbook reference bundle slots in
  `referenceBundleSlots`;
- mapping dependency kind to generation purpose in `dependencyForInputKind`;
- resolving prepared inputs;
- building dependency graph nodes in `buildShotVideoTakeDependencyMap`;
- estimating dependency draft specs in `estimateDraftDependency`;
- hand-authoring non-shot draft specs in `draftSpecForDependency`;
- aggregating totals in `aggregateDependencyEstimate`;
- deriving plan lines in `planLinesFromDependencyMap`;
- projecting References tab groups in `buildCastMemberReferenceGroup`,
  `buildLocationReferenceGroup`, `buildLookbookReferenceChoices`, and
  `buildGeneralReferenceChoices`.

That is too much ownership for one purpose file. It also makes it easy for cast,
location, and lookbook behavior to drift.

The Mara regression is a direct example:

- `buildLocationReferenceGroup` creates a planned location-sheet card when no
  environment sheet exists.
- `buildCastMemberReferenceGroup` creates a planned character-sheet card only
  when `selected` is true.
- The heading comes from scene narrative scope, but the card comes from local
  asset/selection logic and an optional graph node lookup.

That means the UI can show a scene-scoped cast member but fail to show the
generated dependency that would make the reference usable.

### Current Tests Prove The Slice, Not The Architecture

`packages/core/tests/integration/media-generation-dependency-graph-estimates.test.ts`
proves that the current shot-video path can price some graph nodes.

`packages/core/tests/integration/media-generation-registry-contract.test.ts`
and
`packages/core/tests/integration/media-generation-purpose-lifecycle-matrix.test.ts`
prove the purpose registry and shared lifecycle exist.

What is still missing:

- a generic graph resolver used by more than one root purpose;
- purpose-owned dependency declarations;
- dependency-kind definitions outside `shot-video-take.ts`;
- asset selectors outside `shot-video-take.ts`;
- draft dependency spec builders owned by the dependency purpose;
- a non-shot proof such as `cast.profile` depending on
  `cast.character-sheet`;
- References tab projection generated from graph nodes, not local section
  reconstruction.

## Rejected Model

This plan explicitly rejects the model previously described in this file.

There must not be:

- `production dependency pricing` versus `catalog option pricing`;
- a References tab catalog that assigns costs outside the dependency graph;
- Studio-side cost calculation;
- local per-section rules that decide whether a missing card is priced;
- fallback totals based only on the final video estimate;
- fake project-relative paths, fake asset files, or placeholder provider inputs
  used to force estimates to pass;
- compatibility branches for obsolete preflight/card shapes;
- a shot-specific graph that other purposes cannot use.

If a reference card shows a cost, it is because it corresponds to a graph node.
If a graph node is a planned generation, its price comes from engines. If a card
is not in the graph, it does not contribute to the root generation total and
should not pretend to be part of the production plan.

## Product Rules

### One Pricing Definition

Each dependency graph node has pricing according to its node kind:

- `existing-asset`: priced at `$0.00`;
- `planned-generation`: estimated through the shared purpose lifecycle and
  engines pricing;
- `final-generation`: estimated through the same provider pricing path for the
  root generation;
- `external-input-required`: not applicable because it is not a generation.

`estimatedTotalUsd` is calculated from graph nodes:

- for a complete plan, sum every priced graph node, including `$0.00` reused
  assets and the final root generation;
- for a partial plan, expose the priced subtotal and list unpriced generation
  nodes explicitly;
- for an unavailable plan, do not present a trustworthy total because the graph
  could not fully resolve.

Missing generated dependencies must never appear as `$0.00`. Missing provider
pricing must be `unpriced` and require explicit unpriced-cost approval before a
real run.

### Graph Owns References

The References tab must render a purpose-specific projection of the graph.

For `shot.video-take`, the graph projection groups dependency nodes into:

- General references:
  `first-frame`, `last-frame`, `reference-image`, and
  `multi-shot-storyboard-sheet`;
- Lookbook references:
  active lookbook dependency nodes;
- Cast Character Sheets:
  `cast-character-sheet` dependency nodes;
- Location Sheets And Views:
  `location-environment-sheet` dependency nodes plus their existing generated
  view assets when available;
- Reference Issues:
  reference/dependency diagnostics from those nodes, shown at the bottom.

The UI must not render orphan scene-scope headings with no graph-backed card.
If Mara appears in Cast Character Sheets, the graph must include Mara's
`cast-character-sheet` dependency node. If a cast member is not part of the
effective reference set for the current root generation, that cast member should
not appear as a priced reference dependency.

### Purpose Policy Declares The Effective Reference Set

The graph does not guess from Studio state. The consuming purpose declares its
dependencies.

For `shot.video-take`, the declaration must derive an effective reference set
from:

- the selected shot group;
- scene narrative scope;
- shot default cast and location references;
- explicit shot reference overrides;
- route/input mode;
- requested inputs;
- input policy.

The same effective set drives both:

- graph dependency slots;
- References tab groups.

That is the only way to keep the final estimate and visible references aligned.

### Provider Optionality Does Not Erase Product Dependencies

Some provider routes can technically run without reference inputs. That is a
provider capability, not the product dependency policy.

If the selected Renku product intent is reference-conditioned video, core still
declares the product reference bundle as dependency slots. Provider optionality
only affects whether the final root estimate can be priced before all dependency
files exist.

### Dependencies Use Concrete Purposes

Generated references must use the concrete purpose that owns the asset:

- cast reference -> `cast.character-sheet`;
- location reference -> `location.environment-sheet`;
- lookbook reference -> `lookbook.sheet` or `lookbook.image`, according to the
  product dependency kind;
- first frame -> `shot.first-frame`;
- last frame -> `shot.last-frame`;
- shot storyboard -> `shot.multi-shot-storyboard-sheet`;
- final video -> `shot.video-take`.

`shot.reference-image` may remain an explicit shot-authored general reference
purpose. It must not become the generic representation for cast, location, or
lookbook references.

## Target Architecture

### Core Modules

Add purpose-neutral dependency graph modules under
`packages/core/src/server/media-generation`.

Proposed files:

- `dependency-kind-registry.ts`;
- `dependency-declaration-registry.ts`;
- `dependency-asset-selectors.ts`;
- `dependency-draft-specs.ts`;
- `dependency-graph.ts`;
- `dependency-plan-lines.ts`;
- `shot-video-take-dependencies.ts`;
- `shot-video-take-reference-projection.ts`;
- `cast-profile-dependencies.ts`.

Responsibilities:

- `dependency-kind-registry.ts`
  owns dependency kind definitions: media kind, cardinality, asset selector,
  missing-input behavior, and default generation purpose.
- `dependency-declaration-registry.ts`
  locates the declaration for each root purpose that participates in graph
  planning.
- `dependency-asset-selectors.ts`
  resolves existing project assets from dependency slots.
- `dependency-draft-specs.ts`
  asks the dependency purpose to build and estimate a draft dependency spec.
- `dependency-graph.ts`
  walks dependency declarations, creates nodes and edges, detects cycles,
  resolves pricing, and computes execution levels.
- `dependency-plan-lines.ts`
  turns graph nodes into generic `MediaGenerationPlanLine` values.
- `shot-video-take-dependencies.ts`
  declares `shot.video-take` dependencies from shot context and route policy.
- `shot-video-take-reference-projection.ts`
  groups graph nodes into the current References tab report.
- `cast-profile-dependencies.ts`
  proves a non-shot root purpose can use the same graph.

These modules must not be wrappers around the old shot-local functions. The old
logic should move into the new owning modules and the obsolete local functions
should be deleted.

### Dependency Kind Definition

Add a purpose-neutral dependency kind definition contract.

```ts
export interface MediaGenerationDependencyKindDefinition {
  dependencyKind: MediaGenerationDependencyKind;
  mediaKind: MediaKind;
  cardinality: 'one' | 'many';
  assetSelector: MediaGenerationAssetSelectorId;
  missingInputBehavior: 'plan-generation' | 'require-attachment';
  generationPurpose?: MediaGenerationPurpose;
}
```

Initial dependency kinds:

- `first-frame`
  - media kind: `image`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.first-frame`.
- `last-frame`
  - media kind: `image`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.last-frame`.
- `reference-image`
  - media kind: `image`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.reference-image`.
- `multi-shot-storyboard-sheet`
  - media kind: `image`;
  - selector: `shot-video-input`;
  - missing behavior: `plan-generation`;
  - generation purpose: `shot.multi-shot-storyboard-sheet`.
- `cast-character-sheet`
  - media kind: `image`;
  - selector: `cast-character-sheet`;
  - missing behavior: `plan-generation`;
  - generation purpose: `cast.character-sheet`.
- `location-environment-sheet`
  - media kind: `image`;
  - selector: `location-environment-sheet`;
  - missing behavior: `plan-generation`;
  - generation purpose: `location.environment-sheet`.
- `lookbook-sheet`
  - media kind: `image`;
  - selector: `lookbook-sheet`;
  - missing behavior: `plan-generation`;
  - generation purpose: `lookbook.sheet`.
- `manual-attachment`
  - media kind: determined by the slot;
  - selector: `manual-attachment`;
  - missing behavior: `require-attachment`;
  - no generation purpose.

Do not duplicate selector, media-kind, or generation-purpose information on
every dependency slot.

### Dependency Slot

Add a slot contract that identifies one dependency instance.

```ts
export interface MediaGenerationDependencySlot {
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  label: string;
  dependencyTarget?: MediaGenerationTarget;
  required: boolean;
  reason: string;
}
```

The slot answers: "What does this root or parent generation need?"

The dependency kind definition answers: "How is that dependency resolved,
generated, and priced?"

Required dependency id shapes:

- `first-frame:<productionGroupId>`;
- `last-frame:<productionGroupId>`;
- `reference-image:<productionGroupId>:<referenceId>`;
- `multi-shot-storyboard-sheet:<productionGroupId>`;
- `cast-character-sheet:<castMemberId>`;
- `location-environment-sheet:<locationId>`;
- `lookbook-sheet:<lookbookId>`;
- `manual-attachment:<stableSubject>`.

The current internal shape `character-sheet:cast-member:<id>` should be replaced
directly. Do not keep aliases for old dependency ids.

### Purpose Dependency Declaration

Extend `MediaGenerationPurposeDefinition` with an optional declaration hook.

```ts
export interface MediaGenerationDependencyDeclarationInput {
  projectName?: string;
  homeDir?: string;
  rootPurpose: MediaGenerationPurpose;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  request: MediaGenerationDependencyRequest;
  parentNodeId?: string;
}

export interface MediaGenerationPurposeDefinition {
  // existing lifecycle members...
  declareDependencies?(
    input: MediaGenerationDependencyDeclarationInput
  ): Promise<MediaGenerationDependencySlot[]>;
  buildDependencyDraftSpec?(
    input: MediaGenerationDependencyDraftSpecInput
  ): Promise<MediaGenerationDependencyDraftSpec>;
}
```

Rules:

- purposes with no dependencies omit `declareDependencies`;
- a dependency declaration may depend on the root request, route, input mode,
  target, and project context;
- the generic graph does not contain shot-specific route input fields;
- consuming purposes own how resolved dependency nodes map back into their
  provider input contract.

### Dependency Draft Specs

Generated dependency nodes must be estimated through the purpose that owns the
generated media.

```ts
export interface MediaGenerationDependencyDraftSpecInput {
  projectName?: string;
  homeDir?: string;
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  dependencyKind: MediaGenerationDependencyKind;
  dependencyTarget: MediaGenerationTarget;
  label: string;
  reason: string;
}

export interface MediaGenerationDependencyDraftSpec {
  purpose: MediaGenerationPurpose;
  spec: MediaGenerationSpec;
}
```

The required first slice implements dependency draft builders for:

- `cast.character-sheet`;
- `location.environment-sheet`;
- `lookbook.sheet`;
- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-image`;
- `shot.multi-shot-storyboard-sheet`.

`shot-video-take.ts` must stop hand-building non-shot draft specs. For example,
it should not know how to build a `cast.character-sheet` spec; the
`cast.character-sheet` purpose should own that.

### Generic Graph Resolution

The generic resolver flow:

1. Receive a root purpose, root target, and root request.
2. Add the root `final-generation` node.
3. Ask the root purpose declaration for dependency slots.
4. For each slot, look up its dependency kind definition.
5. Resolve existing assets through the registered asset selector.
6. If an existing asset satisfies the slot, add an `existing-asset` node priced
   at `$0.00`.
7. If no asset satisfies the slot and the dependency kind has a generation
   purpose, ask that purpose for a draft dependency spec.
8. Estimate the draft spec through the shared generation service and engines.
9. Add a `planned-generation` node with `priced` or `unpriced` pricing.
10. Recursively declare and resolve dependencies for the planned node's purpose.
11. If the dependency cannot be generated, add an `external-input-required`
    node.
12. Detect cycles and return structured diagnostics.
13. Compute topological execution levels.
14. Estimate the root node through the root purpose's pricing path.
15. Aggregate the graph estimate from graph nodes.

The graph resolver is read-only. It must not persist specs, assets, asset files,
or runs.

### Root Estimate With Planned Dependencies

Read-only planning must not use fake files.

During planning:

- existing assets use real project-relative files;
- planned dependencies use typed dependency output descriptors;
- manual attachments produce missing nodes;
- final/root pricing may be computed only when the engine estimator can price
  from the root request and dependency descriptors.

During materialization and run:

- every provider input that requires a file must resolve to a real imported
  asset file;
- the final/root spec cannot be persisted while required generated dependencies
  are still only planned;
- after each dependency import, callers refresh the graph before materializing
  the next level or root spec.

### Asset Selectors

Asset selectors are deterministic core code. They do not live in Studio.

Initial selectors:

- `shot-video-input`;
- `cast-character-sheet`;
- `location-environment-sheet`;
- `lookbook-sheet`;
- `manual-attachment`.

Selector rules:

- selected existing assets contribute `$0.00`;
- ambiguous selected assets are structured diagnostics;
- missing selected asset files are structured diagnostics;
- missing generated assets become planned generation nodes when the dependency
  kind has a generation purpose;
- missing non-generatable assets become required attachment nodes.

### Shot Video Reference Projection

`readShotVideoTakeProductionPlan` should stop building references by separately
walking scene scope, assets, and shot specs.

Instead:

1. Build the `shot.video-take` dependency graph.
2. Build `MediaGenerationPlanLine[]` from graph nodes.
3. Project graph nodes into the `ShotVideoTakeProductionPlanReport.references`
   shape.
4. Render one card per relevant graph node or existing-asset candidate.
5. Put reference/dependency diagnostics in the bottom `Reference Issues`
   section.

`packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx`
should render the report. It should not reconstruct selected cast ids from
`shot.shotSpecs` to decide whether a card is selected or priced.

### Non-Shot Proof

The implementation must prove the graph is not shot-video-only.

Required proof: `cast.profile`.

For `cast.profile`, the graph should:

- declare a `cast-character-sheet:<castMemberId>` dependency;
- reuse an existing character sheet at `$0.00`;
- plan a missing `cast.character-sheet` dependency when no sheet exists;
- estimate the missing sheet through the shared purpose lifecycle;
- estimate the root `cast.profile` generation;
- sum both generation nodes in the graph estimate;
- prevent profile spec materialization until the required character sheet is a
  real imported asset.

This is the minimum proof that the resolver is a shared media-generation
architecture, not a renamed shot-video implementation.

## Diagnostics

Use structured diagnostics at package boundaries.

Proposed codes:

- `CORE_MEDIA_DEPENDENCY_UNREGISTERED_KIND`;
- `CORE_MEDIA_DEPENDENCY_UNREGISTERED_DECLARATION`;
- `CORE_MEDIA_DEPENDENCY_MISSING_DRAFT_BUILDER`;
- `CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC`;
- `CORE_MEDIA_DEPENDENCY_ESTIMATE_FAILED`;
- `CORE_MEDIA_DEPENDENCY_UNPRICED_NODE`;
- `CORE_MEDIA_DEPENDENCY_SELECTOR_MISSING_ASSET_FILE`;
- `CORE_MEDIA_DEPENDENCY_SELECTOR_AMBIGUOUS_SELECTION`;
- `CORE_MEDIA_DEPENDENCY_REQUIRED_ATTACHMENT`;
- `CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED`;
- `CORE_MEDIA_DEPENDENCY_ROOT_ESTIMATE_UNAVAILABLE`;
- `CORE_SHOT_VIDEO_REFERENCE_OUT_OF_SCOPE`;
- `CORE_SHOT_VIDEO_REFERENCE_EFFECTIVE_SET_EMPTY`.

Reference Issues in Studio should include reference/dependency diagnostics only.
Warnings such as "final prompt not drafted" belong in the AI Production or run
setup surface, not in References.

## ADR And Documentation Work

Add a new decision record:

- `docs/decisions/0027-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`

The ADR should state:

- the dependency graph is the source of truth for references and pricing;
- there is one pricing meaning;
- engines pricing is the source for generated node costs;
- graph totals are sums of graph generation nodes;
- purpose definitions own dependency declarations and draft specs;
- Studio and CLI render graph projections only;
- no compatibility/fallback estimate paths are allowed.

Update:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/cli/commands.md` if command output changes.

Do not edit historical ADR `0021` except by superseding it through the new ADR
and existing ADR `0025`.

## Implementation Phases

### Phase 1: Contract Audit

- Confirm every current caller of `MediaGenerationDependencyMap`.
- Confirm every current caller of `MediaGenerationPlanLine`.
- Confirm every current caller of `ShotVideoTakeReferenceCardPlan`.
- Confirm all places Studio or core still infer card pricing outside graph
  nodes.
- Confirm exact current dependency id shapes and replace them directly.
- Confirm whether `lookbook-sheet` remains the immediate shot-video dependency
  or whether the product wants `lookbook.image` as the reference dependency.
  Choose one in the dependency kind definition and update callers directly.

### Phase 2: Shared Dependency Contracts

- Add `MediaGenerationDependencySlot`.
- Add `MediaGenerationDependencyKindDefinition`.
- Add `MediaGenerationAssetSelectorId`.
- Add `MediaGenerationDependencyDeclarationInput`.
- Add `MediaGenerationDependencyDraftSpecInput`.
- Add `MediaGenerationDependencyDraftSpec`.
- Extend `MediaGenerationPurposeDefinition` with dependency declaration and
  draft-spec hooks.
- Update current client exports directly.

### Phase 3: Shared Resolver Foundation

- Add dependency kind registry.
- Add dependency declaration registry.
- Add asset selectors.
- Add dependency draft spec estimation.
- Add generic graph resolver.
- Add generic graph aggregate.
- Add generic topological execution levels.
- Add generic plan-line projection.
- Add structured diagnostics.

### Phase 4: Purpose-Owned Draft Builders

- Move non-shot draft construction out of `shot-video-take.ts`.
- Add `buildDependencyDraftSpec` to `cast.character-sheet`.
- Add `buildDependencyDraftSpec` to `location.environment-sheet`.
- Add `buildDependencyDraftSpec` to `lookbook.sheet`.
- Add `buildDependencyDraftSpec` to shot input purposes.
- Validate and estimate every draft spec through the existing shared service.

### Phase 5: Non-Shot Proof

- Add `cast.profile` dependency declaration.
- Add `cast.profile` graph planning/estimate entry point.
- Ensure materialization waits for real dependency assets.
- Add integration tests proving missing and existing character-sheet paths.

### Phase 6: Shot Video Graph Migration

- Move dependency slot declaration out of `shot-video-take.ts`.
- Move asset resolution out of `shot-video-take.ts`.
- Move graph construction out of `shot-video-take.ts`.
- Move plan-line projection out of `shot-video-take.ts`.
- Keep shot-video-specific route policy in `shot-video-take-dependencies.ts`.
- Keep shot-video provider payload construction in the shot-video purpose.
- Delete obsolete local graph functions after callers are updated.

### Phase 7: References Projection

- Replace cast/location/lookbook/general section builders with graph projection.
- Ensure every visible generated reference card corresponds to a graph node.
- Ensure no orphan cast/location headings render.
- Ensure Mara's missing character sheet appears when Mara is in the effective
  reference set.
- Ensure location sheets and cast sheets use the same planned-node behavior.
- Ensure Reference Issues is bottom-positioned and includes only reference
  diagnostics.

### Phase 8: Studio Cleanup

- Remove selected-cast reconstruction from the References tab.
- Render card pricing only from `ShotVideoTakeReferenceCardPlan.pricing`.
- Render selected state only from the core report.
- Keep mutations as user intent changes, then refresh the graph/report.
- Keep all feature controls on local shadcn UI primitives.

### Phase 9: Materialization And Agent Flow

- Materialize dependency specs node by node from graph levels.
- Import completed dependency outputs before planning the next dependent level.
- Refresh the graph after imports.
- Materialize final/root specs only after required provider inputs resolve to
  real asset files.
- Preserve approval tokens for priced nodes.
- Require explicit override for unpriced nodes.

### Phase 10: Documentation And Verification

- Add ADR `0027`.
- Update architecture reference docs.
- Update CLI docs if output changes.
- Run focused core tests.
- Run focused Studio tests.
- Run package typechecks.
- Run lint/check before calling the plan complete.
- Verify the References tab in browser on a fixture that includes a missing
  default cast member such as Mara and a missing location sheet.

## Integration Test Plan

### Generic Graph Contract Tests

Add or expand:

- `packages/core/tests/integration/media-generation-dependency-graph-estimates.test.ts`

Required cases:

- dependency kind registry owns media kind, selector, cardinality, missing
  behavior, and generation purpose;
- dependency slots contain identity, target, label, required state, and reason,
  not duplicated selector/generation data;
- graph resolver supports multiple root purposes;
- graph nodes contain `dependencyKind` and `dependencyId`, not shot-video route
  input fields;
- graph aggregate sums priced generation nodes and marks unpriced/missing nodes
  correctly;
- cycle diagnostics are structured.

### Cast Profile Proof Tests

Add:

- `packages/core/tests/integration/cast-profile-dependency-graph-estimates.test.ts`

Required cases:

- missing character sheet plans a priced `cast.character-sheet` dependency;
- existing character sheet is reused at `$0.00`;
- total includes root `cast.profile` plus generated dependencies;
- final `cast.profile` spec materialization fails until planned character-sheet
  dependency resolves to a real asset.

### Shot Video Regression Tests

Add or expand:

- `packages/core/tests/integration/shot-video-reference-dependency-graph-estimates.test.ts`
- relevant Studio tests under
  `packages/studio/src/features/movie-studio/scenes`.

Required cases:

- reference intent emits cast character-sheet graph nodes from the effective
  reference set;
- a default cast member with no character sheet produces a planned priced card;
- Mara-equivalent fixture does not render an orphan heading;
- location sheet and cast sheet missing states use the same planned-node path;
- existing cast/location/lookbook assets are reused at `$0.00`;
- final estimate equals the sum of graph generation nodes;
- final prompt warnings do not appear in Reference Issues;
- Studio renders the core report without reconstructing selection/pricing.

## Acceptance Criteria

- There is a new ADR documenting the graph as the single source of truth for
  references and pricing.
- There is one pricing meaning in code and docs.
- Every generated dependency price comes from engines through the shared media
  generation lifecycle.
- The graph resolver is purpose-neutral and used by at least `shot.video-take`
  and `cast.profile`.
- Purpose definitions own dependency declarations.
- Dependency purposes own dependency draft specs.
- `shot-video-take.ts` no longer owns generic graph construction, aggregate
  pricing, non-shot draft specs, or References tab grouping.
- The References tab renders graph-backed reference groups.
- Missing cast and location references behave symmetrically.
- Mara-equivalent missing cast references render as graph-backed planned cards
  when they are in the effective reference set.
- The total estimate is the graph total, not final-video-only pricing.
- No Studio code computes generation prices.
- No fake files, fake URLs, fake asset records, or placeholder project-relative
  paths are used to estimate or materialize final/root specs.
- Unpriced nodes are explicit and require override before real generation.
- Required manual attachments are not priced and prevent a complete plan.
- Integration tests prove the generic graph contract, non-shot proof, and shot
  References regression.

## Completion Checklist

Use this checklist during implementation. The plan is not complete until every
item is checked or explicitly replaced by a reviewed plan update.

### Review And Scope

- [ ] Confirm this plan replaces the old shot-reference-selection resolver
  model.
- [ ] Confirm no catalog-option pricing remains in docs or code.
- [ ] Confirm the active implementation does not use the obsolete maintainer
  workflow.
- [ ] Confirm all work stays inside the shared media-generation architecture.
- [ ] Confirm no compatibility layer preserves old dependency id shapes.
- [ ] Confirm no fallback final-video-only estimate is kept.
- [ ] Confirm Studio remains a renderer of core planning reports.

### ADR And Documentation

- [ ] Add ADR `0027` for graph-backed references and pricing.
- [ ] Update `docs/architecture/media-generation.md`.
- [ ] Update `docs/architecture/reference/media-generation.md`.
- [ ] Update CLI documentation if graph output changes.
- [ ] Remove any new wording that implies two pricing meanings.
- [ ] Document estimate state rules with complete, partial, and unavailable
  examples.

### Shared Contracts

- [ ] Add `MediaGenerationDependencySlot`.
- [ ] Add `MediaGenerationDependencyKindDefinition`.
- [ ] Add `MediaGenerationAssetSelectorId`.
- [ ] Add `MediaGenerationDependencyDeclarationInput`.
- [ ] Add `MediaGenerationDependencyDraftSpecInput`.
- [ ] Add `MediaGenerationDependencyDraftSpec`.
- [ ] Extend `MediaGenerationPurposeDefinition` with `declareDependencies`.
- [ ] Extend `MediaGenerationPurposeDefinition` with
  `buildDependencyDraftSpec`.
- [ ] Export the new contracts from the owning client/core entry points.
- [ ] Delete obsolete contract fields instead of aliasing them.

### Dependency Kind Registry

- [ ] Register `first-frame`.
- [ ] Register `last-frame`.
- [ ] Register `reference-image`.
- [ ] Register `multi-shot-storyboard-sheet`.
- [ ] Register `cast-character-sheet`.
- [ ] Register `location-environment-sheet`.
- [ ] Register `lookbook-sheet`.
- [ ] Register `manual-attachment`.
- [ ] Ensure each definition owns media kind, selector, cardinality, missing
  behavior, and generation purpose.
- [ ] Add structured diagnostics for unregistered dependency kinds.

### Asset Selectors

- [ ] Implement `shot-video-input` selector.
- [ ] Implement `cast-character-sheet` selector.
- [ ] Implement `location-environment-sheet` selector.
- [ ] Implement `lookbook-sheet` selector.
- [ ] Implement `manual-attachment` selector behavior.
- [ ] Resolve selected existing assets deterministically.
- [ ] Report missing asset files as structured diagnostics.
- [ ] Report ambiguous selected assets as structured diagnostics.
- [ ] Price reused assets as `$0.00`.

### Generic Graph Resolver

- [ ] Build root final-generation node.
- [ ] Resolve dependency declarations recursively.
- [ ] Create existing-asset nodes.
- [ ] Create planned-generation nodes.
- [ ] Create external-input-required nodes.
- [ ] Estimate planned dependency specs through the shared service.
- [ ] Estimate root generation through the root purpose pricing path.
- [ ] Aggregate graph estimate from graph nodes.
- [ ] Produce topological execution levels.
- [ ] Detect cycles with structured diagnostics.
- [ ] Avoid writes during graph planning.

### Draft Spec Ownership

- [ ] Move `cast.character-sheet` draft dependency spec building into the cast
  character-sheet purpose.
- [ ] Move `location.environment-sheet` draft dependency spec building into the
  location environment-sheet purpose.
- [ ] Move `lookbook.sheet` draft dependency spec building into the lookbook
  sheet purpose.
- [ ] Add draft builders for shot input purposes.
- [ ] Delete shot-local non-shot draft construction.
- [ ] Validate every draft through the existing purpose lifecycle.
- [ ] Estimate every draft through engines via the shared service.

### Non-Shot Proof

- [ ] Add `cast.profile` dependency declaration.
- [ ] Add `cast.profile` graph planning/estimate path.
- [ ] Reuse existing character sheets at `$0.00`.
- [ ] Plan missing character sheets as `cast.character-sheet`.
- [ ] Include generated character-sheet cost in the `cast.profile` graph total.
- [ ] Block final `cast.profile` materialization until dependency assets exist.
- [ ] Add integration tests for missing, reused, and unresolved dependency
  paths.

### Shot Video Migration

- [ ] Move shot-video dependency declaration out of `shot-video-take.ts`.
- [ ] Move reference bundle policy into `shot-video-take-dependencies.ts`.
- [ ] Use scene narrative scope and shot reference policy once.
- [ ] Use effective cast/location reference sets for both graph and UI
  projection.
- [ ] Replace old dependency ids directly.
- [ ] Keep provider payload construction purpose-owned.
- [ ] Delete local graph aggregate code from `shot-video-take.ts`.
- [ ] Delete local plan-line projection from `shot-video-take.ts`.
- [ ] Delete local non-shot draft spec construction from `shot-video-take.ts`.

### References Projection

- [ ] Project General references from graph nodes.
- [ ] Project Lookbook references from graph nodes.
- [ ] Project Cast Character Sheets from graph nodes.
- [ ] Project Location Sheets And Views from graph nodes and generated views.
- [ ] Ensure missing cast and location cards are generated symmetrically.
- [ ] Ensure no orphan cast/location headings render.
- [ ] Ensure Mara-equivalent default cast references appear when in the
  effective reference set.
- [ ] Move Reference Issues to bottom projection only.
- [ ] Exclude final prompt/run setup warnings from Reference Issues.

### Studio

- [ ] Remove selected cast id reconstruction from
  `scene-shot-references-tab.tsx`.
- [ ] Remove any Studio-side dependency pricing inference.
- [ ] Render card pricing from `ShotVideoTakeReferenceCardPlan.pricing`.
- [ ] Render selected/default state from the core report.
- [ ] Refresh the graph/report after reference mutations.
- [ ] Keep local shadcn UI controls only.
- [ ] Add/update Studio tests for the References tab projection.

### Materialization And Agent Flow

- [ ] Materialize planned dependency specs by graph execution level.
- [ ] Import generated dependency outputs before dependent nodes run.
- [ ] Refresh the graph after imports.
- [ ] Materialize final/root specs only after required inputs resolve to real
  asset files.
- [ ] Preserve approval token behavior for priced nodes.
- [ ] Preserve explicit unpriced override behavior for unpriced nodes.
- [ ] Ensure no fake files, URLs, paths, assets, or provider inputs are created.

### Verification

- [ ] Run focused core dependency graph tests.
- [ ] Run focused shot-video production tests.
- [ ] Run focused Studio References tab tests.
- [ ] Run `pnpm --dir packages/core exec tsc --noEmit`.
- [ ] Run `pnpm --dir packages/studio exec tsc --noEmit`.
- [ ] Run package lint/check commands appropriate to touched packages.
- [ ] Browser-verify the shot References tab on a fixture with missing cast and
  location references.
- [ ] Browser-verify AI Production total equals the graph total.
- [ ] Confirm no server is left running unless the user asks for one.
