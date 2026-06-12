# 0062 Shot Video Take Core Refactor

Status: proposed
Date: 2026-06-11

## Dependency Planning Supersession

As of `0063-generation-dependency-inventory-rewrite.md` and
`0064-generation-dependency-inventory-cleanup.md`, the dependency graph bridge,
dependency-map file, execution-level language, and graph-preserving split
direction in this plan are superseded for media-generation dependency planning.

Future shot-video file-size refactors may still use this plan for the broader
module-splitting goal, but dependency work must build on the shared dependency
inventory contract:

- dependency declarations come from purpose-owned inventory slots;
- dependency ids are built and parsed only by core-owned dependency id helpers;
- Studio consumes core-provided mutation fields instead of parsing dependency
  ids;
- inventory lines and the root generation line are the pricing source;
- dependency lines are not an automatic execution graph.

## Summary

`packages/core/src/server/media-generation/shot-video-take.ts` has grown into a
large, mixed-responsibility module. It is currently 4,808 lines long and owns
too many unrelated concerns:

- project/session loading;
- shot group preparation;
- rail group mutation;
- route/model reporting;
- preflight reporting;
- dependency graph construction;
- reference section projection;
- shot input selection;
- generation spec validation and lifecycle helpers;
- provider payload building;
- media import and file IO;
- low-level title, id, MIME, and diagnostic helpers.

That shape directly conflicts with the repository guidance in `AGENTS.md` and
`docs/architecture/coding-practices.md`: functions should stay focused, modules
should have clear ownership, branching should reflect domain cases instead of
missing structure, and complex media generation behavior should be kept
reviewable through focused modules, handler maps, typed registries, and scoped
tests.

This plan refactors the shot-video-take core implementation into a folder of
domain-owned modules, splits the large test file by behavior, and adds a source
size warning/check so future work gets nudged toward refactoring before files
become architecture problems.

## Current Evidence

The current source file is too large for meaningful review:

```text
packages/core/src/server/media-generation/shot-video-take.ts: 4,808 lines
packages/core/src/server/media-generation/shot-video-take.test.ts: 1,226 lines
```

Approximate large function spans in `shot-video-take.ts`:

- `planShotVideoTakeProduction`: 122 lines, starting around line 581.
- `updateShotVideoTakeRailGroups`: 109 lines, starting around line 366.
- `buildContextFromPrepared`: 108 lines, starting around line 4306.
- `buildShotVideoTakeProductionPlanReport`: 94 lines, starting around line 730.
- `buildGeneralReferenceChoices`: 90 lines, starting around line 1103.
- `prepareShotGroupInSession`: 83 lines, starting around line 4223.
- `importGeneratedFile`: 83 lines, starting around line 4453.
- `buildLocationReferenceGroup`: 78 lines, starting around line 924.
- `buildShotVideoTakeDependencyMap`: 76 lines, starting around line 1758.
- `estimateFinalPlanLine`: 76 lines, starting around line 1892.

Approximate large test spans in `shot-video-take.test.ts`:

- `deletes an input take and promotes another matching take when selected`: 123
  lines.
- `uses the selected lookbook sheet as the concrete ready reference input`: 113
  lines.
- `shows scene cast choices without planning unselected character-sheet
  dependencies`: 110 lines.
- `copies group settings on split and marks copied prompts stale for new shot
  ids`: 90 lines.

The problem is not only raw line count. The file forces unrelated changes into a
single review surface. A small change to Lookbook reference cards, rail grouping,
provider payloads, final video pricing, or input deletion all touches the same
module and the same broad test file.

## Relevant Architecture Rules

This refactor is required by existing project rules rather than by preference.

From `AGENTS.md`:

- keep functions focused and shallow;
- avoid long command, purpose, provider, route, or media-kind dispatch inside
  one exported body;
- use purpose-specific modules, registries, focused parsers, or typed maps when
  behavior branches by purpose, route, or provider;
- do not add wrapper components, wrapper functions, adapter files, facade
  modules, or pass-through helpers to preserve old names;
- do not add convenience re-exports to avoid fixing callers;
- when a file structure changes, update callers directly and delete the old
  path.

From `docs/architecture/coding-practices.md`:

- functions should do one job at one level of abstraction;
- high cyclomatic complexity is not allowed as a normal implementation style;
- media generation purpose dispatch is explicitly called out as a place where
  complexity must be controlled;
- when touching a complex area, add enforcement that keeps it from regressing.

From `docs/architecture/media-generation.md` and
`docs/architecture/reference/media-generation.md`:

- generation and import remain separate;
- purpose definitions own purpose-specific behavior;
- shared generation service owns common lifecycle;
- dependency planning and graph totals are shared architecture, not Studio-side
  or shot-only pricing shortcuts;
- root spec creation/update should use dependency planning and fail fast while
  required dependencies are unresolved.

## Goals

- Delete the 4,808-line `shot-video-take.ts` file.
- Replace it with a `shot-video-take/` folder where each module has one domain
  responsibility.
- Keep the current public `ProjectDataService` behavior stable unless this plan
  explicitly calls out a contract adjustment.
- Update callers directly to the new owning modules instead of preserving the
  old file as a compatibility barrel.
- Keep individual production modules small enough to review in one sitting.
- Split the large test file into behavior-focused test files with shared test
  fixtures.
- Add source-size warning/check coverage so future large files are visible
  before they become normal.
- Preserve structured diagnostics and current fail-fast behavior.

## Non-Goals

- Do not redesign the shot-video product contract.
- Do not change database schema or write Drizzle migrations.
- Do not add compatibility shims, old-name aliases, or re-export stubs.
- Do not move provider catalogs out of `packages/engines`.
- Do not add new package dependencies.
- Do not hand-write a broad generic media-generation framework beyond the
  existing shared dependency graph and purpose registry direction.
- Do not use this refactor to solve unrelated Studio UI behavior.

## Refactor Principle

The split should follow ownership, not alphabetical grouping.

Good module boundaries answer a concrete question:

- How is a shot group resolved from scene, shot list, shots, and production
  group?
- How are rail groups persisted and carried forward?
- Which inputs does a selected shot-video route require?
- How is a dependency map built from current context and input policy?
- How is the References report projected from graph nodes and project assets?
- How is a generation spec normalized, validated, prepared, estimated, and run?
- How is existing media imported as a shot input or final take?

Bad module boundaries hide the problem:

- `helpers.ts`
- `utils.ts`
- `common.ts`
- `shot-video-take-core.ts`
- `shot-video-take-service.ts`
- `index.ts` as a pure re-export barrel
- a new thin `shot-video-take.ts` that only delegates to other modules

## Proposed Folder Structure

Create a folder at:

```text
packages/core/src/server/media-generation/shot-video-take/
```

Proposed production files:

```text
shot-video-take/
  diagnostics.ts
  project-session.ts
  context.ts
  shot-group.ts
  production-groups.ts
  model-list.ts
  route-settings.ts
  provider-payloads.ts
  production-plan.ts
  preflight-report.ts
  input-selection.ts
  media-imports.ts
  generation-runs.ts
  resource-keys.ts
  reference-sections.ts
  reference-scope.ts
  reference-selection.ts
  reference-cards.ts
  dependency-slots.ts
  dependency-map.ts
  dependency-draft-specs.ts
  input-specs.ts
  final-specs.ts
```

This is intentionally a folder of direct owners, not a folder with a public
barrel. Callers should import from the module that owns the function.

### `diagnostics.ts`

Owns only small diagnostic construction helpers for this feature.

Exports:

- `shotVideoTakeIssue`.

Rules:

- Keep codes stable.
- Do not hide package-boundary failures behind loose `Error`.
- If a helper starts branching by workflow, move that logic to the workflow
  module.

### `project-session.ts`

Owns shot-video project/session access helpers that are specific to this
feature's server-side context construction.

Exports:

- `withShotProjectSession`;
- `requireProjectRecord`;
- `requireScreenplayDocument`;
- `requireSceneHierarchy`.

Reasoning:

These functions currently sit at the bottom of the giant file and are used
across context, plan, import, selection, and spec flows. They are not media
generation business rules, but they are a real boundary: project database access
for shot-video-take workflows.

### `shot-group.ts`

Owns the prepared shot group contract.

Exports:

- `PreparedShotVideoTakeGroup`;
- `prepareShotVideoTakeGroupInSession`;
- `normalizeShotVideoTakeShotIds`;
- `sceneShotGroupTargetId`;
- `sameShotVideoTakeShotIds`.

Rules:

- Keep persistence optional and explicit through `persist: false`.
- Keep normalization fail-fast for empty, duplicate, unknown, or non-contiguous
  shot ids.
- Do not reach into provider, dependency graph, or reference card code.

### `context.ts`

Owns `ShotVideoTakeGenerationContext` construction.

Exports:

- `buildShotVideoTakeContext`;
- `buildShotVideoTakeContextFromPreparedGroup`.

Depends on:

- `project-session.ts`;
- `shot-group.ts`;
- `reference-scope.ts`;
- `reference-selection.ts`;
- `resource-keys.ts`.

Rules:

- Context construction may read project data and assemble the public context.
- Context construction must not estimate, import, mutate rail groups, or build
  provider payloads.

### `production-groups.ts`

Owns production group and rail group mutation.

Exports:

- `updateShotVideoTakeProductionGroup`;
- `updateShotVideoTakeRailGroups`;
- `normalizeShotVideoTakeRailGroupInputs`;
- `carryShotVideoTakeProductionForShotMembership`;

Private or local functions:

- `resolveRailGroupSource`;
- `requireProductionGroupId`;
- `addSingleShotProductionGroupsForClearedRailShots`;
- `keepUnchangedSingleShotProductionGroups`;
- `findSingleShotProductionGroup`;
- `orderProductionGroupsForShotList`.

Rules:

- This module may mutate the scene shot list document.
- It must not build preflight plans, provider payloads, or reference reports.
- Rail split/merge behavior must stay covered by focused tests.

### `model-list.ts`

Owns model list report construction.

Exports:

- `listShotVideoTakeModels`;
- `listShotInputModels`;
- `defaultShotVideoTakeModelChoiceForInputMode`;
- `shotVideoTakeModelChoices`;
- `shotVideoTakeInputModelChoices`.

Rules:

- Route facts still come from `@gorenku/studio-engines`.
- Do not infer capabilities from provider schema names.
- Keep route parameter reporting route-specific.

### `route-settings.ts`

Owns route setting normalization and route support helpers.

Exports:

- `normalizeShotVideoTakeRouteSettingsForContext`;
- `requireShotVideoTakeRoute`;
- `shotVideoTakeRouteParameters`;
- `shotVideoTakeInputRolesForRoute`;
- `shotVideoTakeDurationSupportForRoute`.

Rules:

- Drop stale settings only through the current route's declared settings.
- Report dropped/invalid settings through structured diagnostics in the caller
  that owns the user-facing plan.

### `provider-payloads.ts`

Owns the path from normalized spec plus route to provider payload.

Exports:

- `buildShotVideoTakeProviderPayload`;
- `buildShotVideoTakePricingProviderPayload`;
- `buildShotVideoTakeInputProviderPayload`;
- `toShotVideoTakeGenerationRequest`.

Rules:

- Keep one provider payload path for validate, estimate, prepare, and run.
- Do not let estimate and run construct different parameter shapes.
- Keep route input-slot mapping in this module or a very small sibling only if
  it becomes independently testable.

### `production-plan.ts`

Owns the read-only computed shot-video production plan.

Exports:

- `planShotVideoTakeProduction`;
- `estimateShotVideoTakeProduction`;
- `readShotVideoTakeProductionPlan`.

Depends on:

- `context.ts`;
- `route-settings.ts`;
- `dependency-map.ts`;
- `preflight-report.ts` only for projection if unavoidable.

Rules:

- Keep this module read-only except for explicitly accepted production input
  preview behavior handled by `preflight-report.ts`.
- Do not list/reference project assets directly here. Reference section
  projection belongs to `reference-sections.ts`.
- Do not import file IO helpers.

### `preflight-report.ts`

Owns the preflight report projection.

Exports:

- `previewShotVideoTakeProduction`;
- `buildShotVideoTakePreflightInputItems`;
- `validateShotVideoTakePreflight`;
- `finalShotVideoTakeSpecForPreflight`.

Rules:

- Preflight can compose context, dependency plan, prepared inputs, missing input
  checklist, prompts, and final-take readiness.
- It must not own dependency slot rules or reference section cards.

### `input-selection.ts`

Owns listing, resolving, selecting, clearing, and deleting shot-video input
takes.

Exports:

- `listShotVideoTakeInputs`;
- `resolveShotVideoTakeInputFile`;
- `selectShotVideoTakeInput`;
- `clearShotVideoTakeInputSelection`;
- `deleteShotVideoTakeInput`;
- `updatePreparedShotVideoTakeInputSelection`.

Rules:

- Selection mutation lives here.
- File deletion for deleted inputs may call `media-imports.ts` file helpers or a
  focused project-file module.
- This module must validate ownership before mutating selection for a production
  group.

### `media-imports.ts`

Owns importing existing/generated files into shot-video-take metadata.

Exports:

- `importShotInputMedia`;
- `importShotFirstFrame`;
- `importShotLastFrame`;
- `importShotReferenceImage`;
- `importShotMultiShotStoryboardSheet`;
- `importShotVideoTake`;
- `importShotVideoTakeProjectFile`;
- `deleteShotVideoTakeProjectFile`.

Rules:

- Generation and import stay separate.
- Import may write asset and asset-file records.
- Import must keep project-relative path safety checks local and explicit.
- Avoid a generic `file-utils.ts`; this is project media import behavior.

### `generation-runs.ts`

Owns run recording for shot input and final video specs.

Exports:

- `runShotInputSpec`;
- `runShotVideoTakeSpec`;
- `recordShotVideoTakeGenerationRun`.

Rules:

- Shared generation service still handles the generic lifecycle where it already
  does.
- This module only owns shot-specific run output paths and run-record fields.

### `resource-keys.ts`

Owns shot-video-take resource key construction.

Exports:

- `shotVideoTakeResourceKeys`.

Rules:

- Keep this as a tiny domain module, not a general event helper.

### `reference-scope.ts`

Owns narrative and shot-level reference scope extraction.

Exports:

- `ShotVideoTakeReferenceScope`;
- `sceneNarrativeShotVideoTakeReferenceScope`;
- `sceneShotVideoTakeReferenceScope`;
- `orderedScreenplayItems`.

Rules:

- This module may read screenplay and scene-location relationships.
- It must not build UI card reports or dependency graph nodes.

### `reference-selection.ts`

Owns selection semantics for cast, location, Lookbook, and prepared reference
inputs.

Exports:

- `selectedShotVideoTakeCastIds`;
- `defaultShotVideoTakeCastIds`;
- `selectedNarrativeShotVideoTakeCastIds`;
- `selectedShotVideoTakeLocationIds`;
- `defaultShotVideoTakeLocationIds`;
- `effectiveScopedShotVideoTakeLocationSelection`;
- `selectedShotVideoTakeLookbookSheetIds`;
- `selectedShotVideoTakeCharacterSheetAssetId`;
- `selectedShotVideoTakeEnvironmentSheetAssetId`;
- `selectedShotVideoTakeLocationViewIds`;

Rules:

- This module owns selection decisions only.
- It must not read assets, estimate dependencies, or build card copy.

### `reference-cards.ts`

Owns the card state projection from graph nodes, plan lines, and previews.

Exports:

- `buildShotVideoTakeReferenceCardPlan`;
- `shotVideoTakeReferenceChoiceState`;
- `shotVideoTakeReferencePreviewImagesForAsset`;
- `shotVideoTakeReferencePreviewImagesForLookbookSheet`;
- `shotVideoTakeReferencePreviewImagesForDependencyNode`.

Rules:

- No database session loading except for direct preview data that cannot be
  provided by the caller. Prefer passing resolved assets/files in.
- No dependency slot computation.

### `reference-sections.ts`

Owns the full References report used by the production plan view.

Exports:

- `buildShotVideoTakeProductionPlanReport`;
- `buildShotVideoTakeGeneralReferenceChoices`;
- `buildShotVideoTakeLookbookReferenceChoices`;
- `buildShotVideoTakeCastMemberReferenceGroup`;
- `buildShotVideoTakeLocationReferenceGroup`.

Rules:

- This module composes reference scope, selection, project assets, graph nodes,
  plan lines, and card projection.
- It must not own dependency map resolution.
- The current hybrid reference projection can be preserved during this refactor,
  but graph-first cleanup from `0060` remains a separate architecture follow-up.

### `dependency-slots.ts`

Owns required input slot construction and dependency ids.

Exports:

- `RequiredShotVideoTakeInputSlot`;
- `requiredShotVideoTakeInputSlots`;
- `referenceBundleShotVideoTakeSlots`;
- `lookbookSheetReferenceSlots`;
- `dependencyIdForShotVideoTakeInput`;
- `parseShotVideoTakeDependencyId`;
- `shotVideoTakeInputKindLabel`;
- `shotVideoTakeRequiredInputLabel`;

Rules:

- This module knows which route/input-mode requires which dependency slots.
- It does not estimate, resolve assets, or build provider payloads.
- Do not use loose string parsing outside this module.

### `dependency-map.ts`

Owns the shot-video dependency graph bridge.

Exports:

- `buildShotVideoTakeDependencyMap`;
- `declareShotVideoTakeDependencies`;
- `estimateFinalShotVideoTakePlanLine`;
- `finalShotVideoTakeEstimateFromDependencyMap`.

Rules:

- Keep dependency graph interaction here.
- Use the shared resolver and shared plan lines.
- Do not duplicate the shared dependency graph architecture.
- Keep final video estimation here only because it is root-node pricing for the
  shot-video plan.

### `dependency-draft-specs.ts`

Owns shot input dependency draft spec materialization.

Exports:

- `ShotVideoTakeDependencyRequest`;
- `buildShotInputDependencyDraftSpec`.

Rules:

- Authored dependency drafts remain required for real materialization.
- Estimate-only drafts may be used only for pricing when current architecture
  explicitly permits them.
- Missing authored drafts must remain structured and agent-readable.

### `input-specs.ts`

Owns first-frame, last-frame, reference-image, and multi-shot-storyboard-sheet
input spec lifecycle behavior.

Exports:

- `validateShotInputSpec`;
- `validateShotFirstFrameSpec`;
- `validateShotLastFrameSpec`;
- `validateShotReferenceImageSpec`;
- `validateShotMultiShotStoryboardSheetSpec`;
- `createShotInputSpec`;
- `createShotFirstFrameSpec`;
- `createShotLastFrameSpec`;
- `createShotReferenceImageSpec`;
- `createShotMultiShotStoryboardSheetSpec`;
- `updateShotInputSpec`;
- `updateShotFirstFrameSpec`;
- `updateShotLastFrameSpec`;
- `updateShotReferenceImageSpec`;
- `updateShotMultiShotStoryboardSheetSpec`;
- `readShotSpec`;
- `readShotFirstFrameSpec`;
- `readShotLastFrameSpec`;
- `readShotReferenceImageSpec`;
- `readShotMultiShotStoryboardSheetSpec`;
- `listShotInputSpecs`;
- `listShotFirstFrameSpecs`;
- `listShotLastFrameSpecs`;
- `listShotReferenceImageSpecs`;
- `listShotMultiShotStoryboardSheetSpecs`;
- `prepareShotInputSpec`;
- `prepareShotInputDraftSpec`;
- `prepareShotFirstFrameSpec`;
- `prepareShotLastFrameSpec`;
- `prepareShotReferenceImageSpec`;
- `prepareShotMultiShotStoryboardSheetSpec`;
- `estimateShotInputSpec`;
- `estimateShotFirstFrameSpec`;
- `estimateShotLastFrameSpec`;
- `estimateShotReferenceImageSpec`;
- `estimateShotMultiShotStoryboardSheetSpec`.

Rules:

- Input spec validation belongs here.
- Provider payload construction is delegated to `provider-payloads.ts`.
- Shared create/update/prepare/estimate wiring should keep using the purpose
  registry where that is already the current architecture.

### `final-specs.ts`

Owns final `shot.video-take` spec lifecycle behavior.

Exports:

- `validateShotVideoTakeSpec`;
- `createShotVideoTakeSpec`;
- `updateShotVideoTakeSpec`;
- `readShotVideoTakeSpec`;
- `listShotVideoTakeSpecs`;
- `prepareShotVideoTakeSpec`;
- `prepareShotVideoTakeDraftSpec`;
- `estimateShotVideoTakeSpec`.

Rules:

- Final spec validation must require resolved dependencies before creation.
- Provider payload construction is delegated to `provider-payloads.ts`.
- Do not add old API aliases.

## Caller Updates

Update callers directly to the new owning modules.

Known callers:

- `packages/core/src/server/project-data-service-wiring/shot-video-take.ts`
- `packages/core/src/server/media-generation/purpose-registry.ts`
- any focused tests that currently import from
  `../media-generation/shot-video-take.js`

Required import rule:

- Do not keep `packages/core/src/server/media-generation/shot-video-take.ts` as
  a delegate file.
- Do not add `shot-video-take/index.ts` as a pure re-export barrel.
- Import from the file that owns the concept, for example:
  - `./shot-video-take/context.js`
  - `./shot-video-take/production-plan.js`
  - `./shot-video-take/dependency-map.js`
  - `./shot-video-take/input-specs.js`
  - `./shot-video-take/final-specs.js`

This follows the no-compatibility-layer and no-re-export-stub rules.

## Implementation Order

### Slice 1: Characterize Existing Behavior

Before moving code, run focused tests around the current behavior and record
which public surfaces must remain stable.

Suggested commands:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/shot-video-take.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-graph-estimates.test.ts --no-file-parallelism
pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --no-file-parallelism
```

If unrelated local changes make these fail, document the failing tests before
the refactor and keep the refactor focused.

### Slice 2: Move Session, Shot Group, Context, And Resource Keys

Extract:

- `project-session.ts`
- `shot-group.ts`
- `context.ts`
- `resource-keys.ts`
- `reference-scope.ts`
- `reference-selection.ts`

Keep public behavior unchanged:

- `buildShotVideoTakeContext` returns the same shape.
- shot group ids and target ids stay stable.
- resource keys stay stable.
- shot id normalization still fails for empty, duplicate, unknown, and
  non-contiguous groups.

Run focused context and rail grouping tests after this slice.

### Slice 3: Move Production Group And Rail Group Mutations

Extract:

- `production-groups.ts`.

Keep behavior unchanged for:

- persisting one-shot rail groups;
- clearing rail groups without deleting single-shot settings;
- splitting a rail group and marking prompts stale for copied shot ids;
- merging rail groups with upper group settings winning;
- rejecting overlapping and non-contiguous groups.

Use this slice to shorten the long `updateShotVideoTakeRailGroups` function by
turning each branch into a named operation.

### Slice 4: Move Model, Route, Settings, And Provider Payloads

Extract:

- `model-list.ts`
- `route-settings.ts`
- `provider-payloads.ts`

Keep behavior unchanged for:

- route-specific parameter reports;
- duration normalization;
- stale setting warnings;
- final provider input-slot mapping;
- pricing provider payloads;
- input image provider payloads.

Important acceptance check:

- The same provider payload builder path must serve validation, estimate,
  prepare, and run.

### Slice 5: Move Dependency Slots, Dependency Map, And Draft Specs

Extract:

- `dependency-slots.ts`
- `dependency-map.ts`
- `dependency-draft-specs.ts`

Keep behavior unchanged for:

- `declareShotVideoTakeDependencies`;
- planned first-frame, last-frame, reference-image, cast sheet, location sheet,
  Lookbook sheet, and storyboard dependencies;
- graph total estimates;
- estimate-only shot input draft behavior from `0061`;
- missing authored draft materialization state;
- structured diagnostics for missing or invalid dependencies.

Important acceptance check:

- The shot-video plan must still use shared dependency graph and shared plan
  lines instead of rebuilding local pricing totals.

### Slice 6: Move Preflight And Production Plan Report Projection

Extract:

- `production-plan.ts`
- `preflight-report.ts`
- `reference-cards.ts`
- `reference-sections.ts`

Keep behavior unchanged for:

- `previewShotVideoTakeProduction`;
- `estimateShotVideoTakeProduction`;
- `planShotVideoTakeProduction`;
- `readShotVideoTakeProductionPlan`;
- `inputsToCreate`;
- `inputPlanItems`;
- `finalTake.canCreateSpec`;
- General, Lookbook, Cast, and Location reference sections.

Important acceptance check:

- Plan construction remains read-only.
- Preview behavior that accepts a temporary production payload must not silently
  persist unless current public behavior already does so.

### Slice 7: Move Input Selection, Imports, Spec Lifecycle, And Runs

Extract:

- `input-selection.ts`
- `media-imports.ts`
- `input-specs.ts`
- `final-specs.ts`
- `generation-runs.ts`

Keep behavior unchanged for:

- imported input file paths in preflight prepared inputs;
- selecting and clearing inputs;
- ownership validation before selection mutation;
- deleting selected inputs and promoting another matching take;
- deleting project files safely;
- importing final video takes;
- input and final spec validation;
- prepare, estimate, and run behavior.

Important acceptance check:

- Import remains separate from generation.
- Project-relative file checks remain strict.
- No raw filesystem path can escape the project folder.

### Slice 8: Delete The Old File And Update Owners

After every extracted module compiles and tests pass:

- delete `packages/core/src/server/media-generation/shot-video-take.ts`;
- update `purpose-registry.ts` to import from the new modules directly;
- update `project-data-service-wiring/shot-video-take.ts` to import from the new
  modules directly;
- update tests to import only from public service surfaces or direct owning
  modules where needed.

Do not leave a compatibility file behind.

### Slice 9: Split Tests

Move the broad test file into focused test files.

Preferred location for broad public-service integration behavior:

```text
packages/core/tests/integration/shot-video-take/
```

Shared test support:

```text
packages/core/tests/support/shot-video-take-fixtures.ts
```

Do not place reusable test fixtures in production `src` unless they are already
production testing utilities. The existing `src/server/testing/project-data-fixtures.ts`
can remain the project fixture owner.

Proposed test files:

```text
packages/core/tests/integration/shot-video-take/preflight.test.ts
packages/core/tests/integration/shot-video-take/production-groups.test.ts
packages/core/tests/integration/shot-video-take/dependency-plan.test.ts
packages/core/tests/integration/shot-video-take/reference-sections.test.ts
packages/core/tests/integration/shot-video-take/input-selection.test.ts
packages/core/tests/integration/shot-video-take/media-imports.test.ts
packages/core/tests/integration/shot-video-take/spec-validation.test.ts
```

Suggested case mapping:

- `preflight.test.ts`
  - reports every requested input slot as a missing required dependency;
  - preserves imported input file paths in preflight prepared inputs;
  - rejects multi-shot final spec without storyboard sheet.

- `production-groups.test.ts`
  - persists and clears one-shot rail groups without deleting single-shot
    settings;
  - copies group settings on split and marks copied prompts stale for new shot
    ids;
  - keeps upper group settings when two rail groups merge;
  - rejects overlapping and non-contiguous rail groups with structured core
    errors.

- `dependency-plan.test.ts`
  - estimates a first-frame take when saved duration is numeric but provider
    expects a string enum;
  - drops stale settings unsupported by the selected route before estimating;
  - includes planned dependency costs in the plan total;
  - reports active Lookbook reference as needed when no reference image exists;
  - shows shot-scoped planned reference image dependencies in the production
    plan.

- `reference-sections.test.ts`
  - shows scene cast choices without planning unselected character-sheet
    dependencies;
  - uses the selected Lookbook sheet as the concrete ready reference input;
  - shows multiple imported image input takes once with one selected.

- `input-selection.test.ts`
  - validates selected input ownership before mutating another group selection;
  - deletes an input take and promotes another matching take when selected.

- `media-imports.test.ts`
  - resolves prepared cast sheet inputs without a shot video take input row;
  - imports shot input media with stable asset/file records;
  - imports final shot video takes with stable resource keys.

- `spec-validation.test.ts`
  - validates input specs against shot group context;
  - validates final specs against route requirements;
  - rejects stale shot groups and unsupported route parameters with structured
    errors.

Fixture helper responsibilities:

- create a temporary home directory;
- write config;
- create the sample movie project;
- read stable sample scene/cast/location ids;
- write a sample shot list;
- write project files under the current project folder;
- create and activate a sample Lookbook;
- import common sheet/input assets.

Fixture helper rules:

- Keep helpers domain-named, not generic.
- Avoid `setupEverything` helpers that hide important test state.
- Prefer small builders such as `writeShotVideoTakeProjectFile` and
  `createActiveShotVideoTakeLookbook`.

## Source Size Hook And Enforcement Proposal

Add a small dependency-free Node script:

```text
scripts/check-source-size.mjs
```

Suggested modes:

```bash
node scripts/check-source-size.mjs --all
node scripts/check-source-size.mjs --staged --warn-only
```

Suggested package scripts:

```json
{
  "source-size:warn": "node scripts/check-source-size.mjs --staged --warn-only",
  "source-size:check": "node scripts/check-source-size.mjs --all"
}
```

Wire `source-size:check` into `check:architecture` after this refactor lands and
the current giant file has been deleted:

```json
{
  "check:architecture": "node scripts/check-no-forbidden-reexports.mjs && node scripts/check-source-size.mjs --all && pnpm --dir packages/core exec vitest run src/server/architecture.test.ts --no-file-parallelism"
}
```

Local Git hook suggestion:

```bash
#!/usr/bin/env sh
pnpm source-size:warn
```

Do not install the Git hook automatically. Document it as an optional local
developer hook, or add a script that prints the hook body. The architecture
check is the source of truth.

Suggested thresholds:

```text
Production source files:
  warn at 450 non-blank, non-comment lines
  fail at 700 non-blank, non-comment lines

Production test files:
  warn at 500 non-blank, non-comment lines
  fail at 850 non-blank, non-comment lines

Integration matrix tests:
  warn at 700 non-blank, non-comment lines
  fail at 1,100 non-blank, non-comment lines
```

Suggested output:

```text
SOURCE_SIZE_WARN packages/core/src/server/media-generation/shot-video-take/production-plan.ts has 512 counted lines. Split the next behavior into a focused module before adding more cases.
SOURCE_SIZE_FAIL packages/core/src/server/media-generation/shot-video-take.ts has 4808 counted lines. This file must be refactored before more behavior is added.
```

Additional ESLint guard:

- Add scoped `max-lines-per-function`, `complexity`, `max-depth`, and
  `no-nested-ternary` rules for
  `packages/core/src/server/media-generation/shot-video-take/**/*.ts`.
- Keep thresholds realistic enough to pass after the split.
- Do not add new dependencies.

Suggested scoped production targets after the split:

```text
complexity: max 8
max-depth: 2
max-lines-per-function: 80
no-nested-ternary: error
```

Suggested scoped test targets:

```text
max-lines-per-function: 120
no-nested-ternary: error
```

The source-size script catches whole-file bloat. ESLint catches huge functions.
Together they provide the warning the current codebase lacked.

## Review Strategy

Keep each implementation PR or commit slice reviewable:

- one slice should move one ownership area;
- each slice should compile;
- each slice should keep tests green or document pre-existing failures;
- avoid opportunistic behavior changes;
- if a behavior bug is found during extraction, add a focused regression test
  first, then fix it in the owning module.

Use mechanical movement only when possible:

- move functions first;
- update imports;
- run typecheck;
- then simplify names and function boundaries once tests prove the move.

Avoid splitting by copying:

- do not duplicate old helper logic into several files;
- extract one owner and update callers to it;
- delete the old implementation from the source file as each section moves.

## Risks And Mitigations

Risk: extraction changes behavior by accident.

Mitigation:

- split tests before deep rewrites where practical;
- preserve public-service integration tests;
- run focused tests after each slice;
- keep module moves mechanical before refactoring function bodies.

Risk: the new folder becomes a collection of smaller vague files.

Mitigation:

- use the folder structure in this plan;
- avoid `utils`, `helpers`, `common`, and compatibility barrels;
- require each file to own a named domain concept.

Risk: circular imports appear between plan, references, dependencies, and
context.

Mitigation:

- keep context independent of plan/report modules;
- keep dependency slots independent of dependency map;
- keep reference card projection independent of context construction;
- pass data down instead of importing a higher-level orchestrator.

Risk: test helpers become another hidden mega-module.

Mitigation:

- keep support helpers small and named by scenario;
- do not create one all-purpose fixture that hides important setup;
- allow repeated setup in tests when it makes the behavior clearer.

Risk: source-size enforcement blocks legitimate generated or matrix files.

Mitigation:

- count only source and test TypeScript files;
- exclude generated code explicitly by path;
- keep integration matrix thresholds higher than ordinary tests;
- require explicit review before adding any allowlist entry.

## Verification Commands

Run focused checks during implementation:

```bash
pnpm --dir packages/core exec vitest run tests/integration/shot-video-take --no-file-parallelism
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-graph-estimates.test.ts --no-file-parallelism
pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --no-file-parallelism
pnpm --dir packages/core test:typecheck
pnpm --dir packages/core lint
```

Run broader checks before completion:

```bash
pnpm test:core
pnpm lint:core
pnpm check:architecture
pnpm check
```

If broader checks fail because of unrelated dirty worktree changes, record the
failure and the suspected unrelated files instead of hiding it.

## Completion Checklist

Use this checklist to track the implementation. The plan is not complete until
every item is checked or explicitly replaced by a reviewed plan update.

### Review Area

- [ ] Confirm the refactor is scoped to
  `packages/core/src/server/media-generation/shot-video-take*`,
  `packages/core/src/server/project-data-service-wiring/shot-video-take.ts`,
  `packages/core/src/server/media-generation/purpose-registry.ts`, focused
  tests, and source-size enforcement.
- [ ] Confirm no database schema change is needed.
- [ ] Confirm no dependency installation is needed.
- [ ] Confirm no Studio browser UI behavior is changed by this refactor.
- [ ] Confirm current dirty worktree changes are not reverted.
- [ ] Capture the current focused test status before moving code.

### Architecture Contracts

- [ ] Preserve generation/import separation.
- [ ] Preserve shared generation service lifecycle usage where it already owns
  create, update, prepare, estimate, and run paths.
- [ ] Preserve shared dependency graph and plan-line usage for shot-video
  dependency totals.
- [ ] Preserve structured diagnostics for preflight, dependency, spec, and
  import failures.
- [ ] Preserve fail-fast behavior for missing route, invalid target, stale shot
  group, invalid file path, missing file, and unresolved required dependencies.
- [ ] Avoid old-name aliases and compatibility functions.
- [ ] Avoid non-index re-export stubs.
- [ ] Avoid a replacement `shot-video-take.ts` delegate file.
- [ ] Avoid a pure `shot-video-take/index.ts` barrel.
- [ ] Update all callers to import from owning modules directly.

### Folder And Module Structure

- [ ] Create `packages/core/src/server/media-generation/shot-video-take/`.
- [ ] Add `diagnostics.ts` for shot-video diagnostic construction only.
- [ ] Add `project-session.ts` for project/session helpers.
- [ ] Add `shot-group.ts` for prepared shot group behavior.
- [ ] Add `context.ts` for `ShotVideoTakeGenerationContext` construction.
- [ ] Add `resource-keys.ts` for shot-video resource keys.
- [ ] Add `production-groups.ts` for production group and rail group mutation.
- [ ] Add `model-list.ts` for model list report construction.
- [ ] Add `route-settings.ts` for route lookup and setting normalization.
- [ ] Add `provider-payloads.ts` for provider payload and generation request
  construction.
- [ ] Add `production-plan.ts` for read-only production plan and estimate
  orchestration.
- [ ] Add `preflight-report.ts` for preflight report construction.
- [ ] Add `input-selection.ts` for input list/select/clear/delete behavior.
- [ ] Add `media-imports.ts` for shot input and final take media import.
- [ ] Add `generation-runs.ts` for shot input and final take run recording.
- [ ] Add `reference-scope.ts` for narrative and shot reference scope.
- [ ] Add `reference-selection.ts` for reference selection semantics.
- [ ] Add `reference-cards.ts` for reference card state/projection.
- [ ] Add `reference-sections.ts` for General, Lookbook, Cast, and Location
  section reports.
- [ ] Add `dependency-slots.ts` for required input slot and dependency id logic.
- [ ] Add `dependency-map.ts` for shot-video dependency graph bridge behavior.
- [ ] Add `dependency-draft-specs.ts` for shot input dependency draft specs.
- [ ] Add `input-specs.ts` for shot input generation specs.
- [ ] Add `final-specs.ts` for final shot video take specs.
- [ ] Delete the old `packages/core/src/server/media-generation/shot-video-take.ts`
  file after callers are updated.

### Session, Context, And Shot Group Slice

- [ ] Move `withShotProjectSession` into `project-session.ts`.
- [ ] Move `requireProjectRecord` into `project-session.ts`.
- [ ] Move `requireScreenplayDocument` into `project-session.ts`.
- [ ] Move `requireSceneHierarchy` into `project-session.ts`.
- [ ] Move `PreparedShotGroup` to `PreparedShotVideoTakeGroup` in
  `shot-group.ts`.
- [ ] Move `prepareShotGroupInSession` to
  `prepareShotVideoTakeGroupInSession`.
- [ ] Move `normalizeShotIds` to `normalizeShotVideoTakeShotIds`.
- [ ] Move `isContiguous` near shot id normalization.
- [ ] Move `sceneShotGroupTargetId` into `shot-group.ts`.
- [ ] Move `sameShotIds` to `sameShotVideoTakeShotIds`.
- [ ] Move `buildShotVideoTakeContext` into `context.ts`.
- [ ] Move `buildContextFromPrepared` into
  `buildShotVideoTakeContextFromPreparedGroup`.
- [ ] Move `shotVideoTakeResourceKeys` into `resource-keys.ts`.
- [ ] Verify context resource keys stay unchanged.

### Production Group Slice

- [ ] Move `updateShotVideoTakeProductionGroup` into `production-groups.ts`.
- [ ] Move `updateShotVideoTakeRailGroups` into `production-groups.ts`.
- [ ] Move rail normalization and validation helpers into
  `production-groups.ts`.
- [ ] Split the body of `updateShotVideoTakeRailGroups` into named operations.
- [ ] Preserve split behavior for copied settings and stale prompts.
- [ ] Preserve merge behavior where upper group settings win.
- [ ] Preserve cleared rail behavior without deleting single-shot settings.
- [ ] Preserve structured errors for overlapping and non-contiguous groups.

### Model And Route Slice

- [ ] Move `listShotVideoTakeModels` into `model-list.ts`.
- [ ] Move `listShotInputModels` into `model-list.ts`.
- [ ] Move `modelChoices` into `model-list.ts` with a clearer
  shot-video-specific name.
- [ ] Move `shotInputModelChoices` into `model-list.ts`.
- [ ] Move `modelReport` into `model-list.ts`.
- [ ] Move `defaultModelChoiceForInputMode` into `model-list.ts`.
- [ ] Move `requireShotVideoTakeRoute` into `route-settings.ts`.
- [ ] Move route parameter and duration helpers into `route-settings.ts`.
- [ ] Move `normalizeRouteSettingsForContext` into `route-settings.ts`.
- [ ] Preserve stale setting warning behavior in `planShotVideoTakeProduction`.

### Dependency Slice

- [ ] Move `RequiredShotVideoTakeInputSlot` into `dependency-slots.ts`.
- [ ] Move `requiredInputSlots` into `dependency-slots.ts`.
- [ ] Move `referenceBundleSlots` into `dependency-slots.ts`.
- [ ] Move `lookbookSheetReferenceSlots` into `dependency-slots.ts`.
- [ ] Move `requiredSlotForRequestedInput` into `dependency-slots.ts`.
- [ ] Move `requiredSlotForInputKind` into `dependency-slots.ts`.
- [ ] Move `dependencyForInputKind` into `dependency-slots.ts`.
- [ ] Move `dependencyIdForInput` into `dependency-slots.ts`.
- [ ] Move `parseDependencyId` into `dependency-slots.ts`.
- [ ] Move shot input kind/label helpers into `dependency-slots.ts`.
- [ ] Move `buildShotVideoTakeDependencyMap` into `dependency-map.ts`.
- [ ] Move `declareShotVideoTakeDependencies` into `dependency-map.ts`.
- [ ] Move `estimateFinalPlanLine` into `dependency-map.ts`.
- [ ] Move `finalEstimateFromDependencyMap` into `dependency-map.ts`.
- [ ] Move `buildShotInputDependencyDraftSpec` into
  `dependency-draft-specs.ts`.
- [ ] Move shot input dependency purpose/config helpers into
  `dependency-draft-specs.ts` or a purpose config module if they are shared.
- [ ] Preserve graph node ids for existing tests unless a deliberate contract
  update is approved.
- [ ] Preserve plan total semantics from shared dependency graph estimates.

### Reference Projection Slice

- [ ] Move `buildShotVideoTakeProductionPlanReport` into
  `reference-sections.ts`.
- [ ] Move General reference choice construction into `reference-sections.ts`.
- [ ] Move Lookbook reference choice construction into `reference-sections.ts`.
- [ ] Move Cast reference group construction into `reference-sections.ts`.
- [ ] Move Location reference group construction into `reference-sections.ts`.
- [ ] Move narrative and shot scope helpers into `reference-scope.ts`.
- [ ] Move selected/default cast helpers into `reference-selection.ts`.
- [ ] Move selected/default location helpers into `reference-selection.ts`.
- [ ] Move selected Lookbook sheet helpers into `reference-selection.ts`.
- [ ] Move selected asset/view helpers into `reference-selection.ts`.
- [ ] Move reference card projection into `reference-cards.ts`.
- [ ] Move preview image helpers into `reference-cards.ts`.
- [ ] Preserve card states for selected-ready, selected-planned, unavailable,
  available, and not-selected.
- [ ] Preserve current diagnostics for out-of-scope cast and location
  references.

### Preflight And Plan Slice

- [ ] Move `planShotVideoTakeProduction` into `production-plan.ts`.
- [ ] Move `estimateShotVideoTakeProduction` into `production-plan.ts`.
- [ ] Move `readShotVideoTakeProductionPlan` into `production-plan.ts`.
- [ ] Move `previewShotVideoTakeProduction` into `preflight-report.ts`.
- [ ] Move `validatePreflight` into `preflight-report.ts`.
- [ ] Move `preparedInputsForContext` into `preflight-report.ts` or
  `input-selection.ts` if it is used outside preflight.
- [ ] Move Lookbook prepared input helpers into the same owner as
  `preparedInputsForContext`.
- [ ] Move `missingDependencies` into `preflight-report.ts`.
- [ ] Move `buildShotVideoTakePreflightInputItems` into `preflight-report.ts`.
- [ ] Move `finalTakeSpecForPreflight` into `preflight-report.ts` or
  `final-specs.ts` if final spec validation needs it.
- [ ] Preserve `finalTake.canCreateSpec` behavior.
- [ ] Preserve prompt report behavior for dependency drafts and final draft.

### Spec And Provider Slice

- [ ] Move `buildShotVideoTakeProviderPayload` into `provider-payloads.ts`.
- [ ] Move `buildShotVideoTakePricingProviderPayload` into
  `provider-payloads.ts`.
- [ ] Move `buildShotVideoTakeInputProviderPayload` into
  `provider-payloads.ts`.
- [ ] Move `toGenerationRequest` into `provider-payloads.ts`.
- [ ] Move route input mapping helpers into `provider-payloads.ts`.
- [ ] Move input spec normalization and validation into `input-specs.ts`.
- [ ] Move final spec normalization and validation into `final-specs.ts`.
- [ ] Move input spec lifecycle exports into `input-specs.ts`.
- [ ] Move final spec lifecycle exports into `final-specs.ts`.
- [ ] Move provider model and output name helpers into the spec/provider module
  that owns them.
- [ ] Preserve `shot.reference-image` title validation.
- [ ] Preserve multi-shot storyboard sheet validation.
- [ ] Preserve final spec required dependency validation.

### Import, Selection, And Run Slice

- [ ] Move input listing and file resolution into `input-selection.ts`.
- [ ] Move input select, clear, and delete behavior into `input-selection.ts`.
- [ ] Move prepared input selection mutation into `input-selection.ts`.
- [ ] Move `importShotInputMedia` and purpose-specific import functions into
  `media-imports.ts`.
- [ ] Move `importShotVideoTake` into `media-imports.ts`.
- [ ] Move project file import/delete helpers into `media-imports.ts`.
- [ ] Move MIME type, stat, hash, and path containment helpers into
  `media-imports.ts` unless another existing project-file owner is a better
  fit.
- [ ] Move `recordShotGenerationRun` into `generation-runs.ts`.
- [ ] Move `runShotInputSpec` into `generation-runs.ts`.
- [ ] Move `runShotVideoTakeSpec` into `generation-runs.ts`.
- [ ] Preserve project-relative path containment checks.
- [ ] Preserve deletion of imported input files on delete.
- [ ] Preserve replacement selection after deleting a selected input.

### Caller Updates

- [ ] Update `project-data-service-wiring/shot-video-take.ts` to import from the
  new owning modules.
- [ ] Update `purpose-registry.ts` to import from the new owning modules.
- [ ] Update focused tests to import from public service APIs where possible.
- [ ] Update focused tests to import direct owning modules only when testing
  module-owned behavior directly.
- [ ] Confirm there are no imports from
  `server/media-generation/shot-video-take.js`.
- [ ] Confirm `rg "shot-video-take\\.js" packages/core/src packages/core/tests`
  returns no stale old-file imports.

### Test Split

- [ ] Create `packages/core/tests/support/shot-video-take-fixtures.ts`.
- [ ] Move sample id lookup into the support fixture.
- [ ] Move sample shot list builder into the support fixture.
- [ ] Move project file writer/existence helpers into the support fixture.
- [ ] Move Lookbook setup helper into the support fixture.
- [ ] Create `preflight.test.ts`.
- [ ] Create `production-groups.test.ts`.
- [ ] Create `dependency-plan.test.ts`.
- [ ] Create `reference-sections.test.ts`.
- [ ] Create `input-selection.test.ts`.
- [ ] Create `media-imports.test.ts`.
- [ ] Create `spec-validation.test.ts`.
- [ ] Delete the old
  `packages/core/src/server/media-generation/shot-video-take.test.ts`.
- [ ] Confirm no new test file exceeds the planned ordinary test threshold
  without an explicit reason.
- [ ] Confirm long test bodies are shortened through meaningful fixtures, not
  hidden assertions.

### Source Size Enforcement

- [ ] Add `scripts/check-source-size.mjs`.
- [ ] Implement `--all` mode.
- [ ] Implement `--staged --warn-only` mode.
- [ ] Count non-blank, non-comment lines.
- [ ] Exclude `dist`, `node_modules`, generated files, and explicit generated
  schema/catalog paths.
- [ ] Add root `source-size:warn` script.
- [ ] Add root `source-size:check` script.
- [ ] Wire `source-size:check` into `check:architecture` after the refactor
  passes.
- [ ] Add scoped ESLint rules for the new shot-video folder.
- [ ] Confirm the size check warns with a refactoring suggestion.
- [ ] Confirm the hard check fails on an intentionally oversized temporary file
  during local validation, then remove that temporary file.
- [ ] Do not commit a permanent allowlist for the old giant file.

### Verification

- [ ] Run
  `pnpm --dir packages/core exec vitest run tests/integration/shot-video-take --no-file-parallelism`.
- [ ] Run
  `pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-graph-estimates.test.ts --no-file-parallelism`.
- [ ] Run
  `pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --no-file-parallelism`.
- [ ] Run `pnpm --dir packages/core test:typecheck`.
- [ ] Run `pnpm --dir packages/core lint`.
- [ ] Run `pnpm test:core`.
- [ ] Run `pnpm lint:core`.
- [ ] Run `pnpm check:architecture`.
- [ ] Run `pnpm check`.
- [ ] Document any checks not run and why.

### Final Review

- [ ] Confirm no production file in the new shot-video folder exceeds 700 counted
  lines.
- [ ] Confirm ordinary files are mostly below the 450-line warning threshold.
- [ ] Confirm no function in the new shot-video folder is still doing unrelated
  session, validation, graph, import, and provider work in one body.
- [ ] Confirm all new module names use domain vocabulary.
- [ ] Confirm no `utils.ts`, `helpers.ts`, `common.ts`, compatibility barrel, or
  thin pass-through module was added.
- [ ] Confirm the old 4,808-line file is gone.
- [ ] Confirm the old 1,226-line test file is gone.
- [ ] Confirm source-size enforcement is active.
- [ ] Confirm this plan's status is updated with implementation notes after the
  refactor is complete.
